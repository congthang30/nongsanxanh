import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, Prisma, StoreStaffRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { StoreScopeService } from '../store/store-scope.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { canTransition } from './order-state.machine';

/**
 * Xu ly vong doi don hang phia cua hang (store staff / warehouse / manager).
 * Moi thao tac kiem tra order.storeId == store cua user (chong IDOR).
 *
 * Luong: PLACED -> STORE_CONFIRMED -> PICKING -> PACKED -> READY_FOR_DELIVERY.
 */
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
    private readonly scope: StoreScopeService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** Danh sach don cua cua hang (theo scope user). */
  async listStoreOrders(user: AuthUser, status?: string, overrideStoreId?: string) {
    let storeId: string | undefined;
    if (overrideStoreId && this.scope.isSystemAdmin(user.roles)) {
      storeId = overrideStoreId;
    } else {
      storeId = this.scope.isSystemAdmin(user.roles)
        ? undefined
        : await this.scope.requireUserStoreId(user.id);
    }
    return this.prisma.order.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(status ? { status: status as OrderStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        delivery: { select: { status: true, shipperId: true } },
        user: { include: { profile: true } },
      },
      take: 200,
    });
  }

  /** Don cho soan hang (STORE_CONFIRMED) cua cua hang. */
  async listOrdersToPick(user: AuthUser) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    return this.prisma.order.findMany({
      where: {
        storeId,
        status: { in: [OrderStatus.STORE_CONFIRMED, OrderStatus.PICKING] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        user: { include: { profile: true } },
      },
    });
  }

  async getStoreOrder(user: AuthUser, orderId: string) {
    return this.scope.getOrderInScope(user.id, user.roles, orderId, {
      items: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
      delivery: { include: { events: true } },
      user: { include: { profile: true } },
      store: { select: { id: true, name: true, code: true } },
    });
  }

  /** Store staff/manager xac nhan don: PLACED -> STORE_CONFIRMED. */
  async confirmOrder(user: AuthUser, orderId: string) {
    return this.transition(
      user,
      orderId,
      OrderStatus.PLACED,
      OrderStatus.STORE_CONFIRMED,
      'Cua hang xac nhan don',
      'ORDER_CONFIRMED',
    );
  }

  /** Bat dau soan hang: STORE_CONFIRMED -> PICKING. */
  async startPicking(user: AuthUser, orderId: string) {
    return this.transition(
      user,
      orderId,
      OrderStatus.STORE_CONFIRMED,
      OrderStatus.PICKING,
      'Bat dau soan hang',
      'ORDER_PICKING',
    );
  }

  /**
   * Danh dau da dong goi: PICKING -> PACKED. Co the kem so luong da pick thuc te.
   */
  async markPacked(
    user: AuthUser,
    orderId: string,
    pickedItems?: { orderItemId: string; quantityPicked: number }[],
  ) {
    const order = await this.scope.getOrderInScope(
      user.id,
      user.roles,
      orderId,
      { items: true },
    );
    if ((order as { status: OrderStatus }).status !== OrderStatus.PICKING) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Chi don dang soan (PICKING) moi co the dong goi',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      if (pickedItems) {
        for (const p of pickedItems) {
          await tx.orderItem.update({
            where: { id: p.orderItemId },
            data: { quantityPicked: p.quantityPicked },
          });
        }
      }
      await this.transitionInTx(
        tx,
        orderId,
        OrderStatus.PICKING,
        OrderStatus.PACKED,
        user.id,
        'Da dong goi',
      );
    });
    this.events.emit('order.packed', { orderId });
    return this.getStoreOrder(user, orderId);
  }

  /** San sang giao: PACKED -> READY_FOR_DELIVERY (delivery da ASSIGNED san). */
  async readyForDelivery(user: AuthUser, orderId: string) {
    return this.transition(
      user,
      orderId,
      OrderStatus.PACKED,
      OrderStatus.READY_FOR_DELIVERY,
      'San sang giao cho shipper',
      'ORDER_READY',
    );
  }

  /** Huy don tu phia cua hang (store staff voi ly do / manager / admin). */
  async cancelByStore(user: AuthUser, orderId: string, reason: string) {
    const order = (await this.scope.getOrderInScope(
      user.id,
      user.roles,
      orderId,
    )) as { id: string; status: OrderStatus; storeId: string };
    const cancellable: OrderStatus[] = [
      OrderStatus.PLACED,
      OrderStatus.STORE_CONFIRMED,
      OrderStatus.PICKING,
      OrderStatus.PACKED,
      OrderStatus.READY_FOR_DELIVERY,
    ];
    if (!cancellable.includes(order.status)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_CANCELLABLE',
        message: 'Don khong the huy o trang thai hien tai',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.releaseForOrder(tx, orderId, user.id);
      await this.transitionInTx(
        tx,
        orderId,
        order.status,
        OrderStatus.CANCELLED,
        user.id,
        reason,
      );
      await this.audit.log(
        {
          action: 'ORDER_CANCELLED',
          actorId: user.id,
          targetType: 'Order',
          targetId: orderId,
          storeId: order.storeId,
          metadata: { reason, by: 'store' },
        },
        tx,
      );
    });
    this.events.emit('order.cancelled', { orderId });
    return this.getStoreOrder(user, orderId);
  }

  // ---------------- helpers ----------------

  private async transition(
    user: AuthUser,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    reason: string,
    auditAction?: string,
  ) {
    const order = (await this.scope.getOrderInScope(
      user.id,
      user.roles,
      orderId,
    )) as { id: string; status: OrderStatus; storeId: string };
    if (order.status !== from) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Don dang o trang thai ${order.status}, khong the chuyen sang ${to}`,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.transitionInTx(tx, orderId, from, to, user.id, reason);
      if (auditAction) {
        await this.audit.log(
          {
            action: auditAction,
            actorId: user.id,
            targetType: 'Order',
            targetId: orderId,
            storeId: order.storeId,
          },
          tx,
        );
      }
    });
    this.events.emit('order.status_changed', { orderId, status: to });
    return this.getStoreOrder(user, orderId);
  }

  private async transitionInTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    actorId: string,
    reason?: string,
  ) {
    if (!canTransition(from, to)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Khong the chuyen tu ${from} sang ${to}`,
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: from, toStatus: to, actorId, reason },
    });
  }
}
