import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { StoreScopeService } from '../store/store-scope.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { canTransition } from './order-state.machine';

/**
 * Xu ly vong doi don hang phia kho / cua hang.
 * Moi thao tac kiem tra order.storeId == store cua user (chong IDOR).
 *
 * Luong: PLACED (cho kho xac nhan) -> STORE_CONFIRMED -> PICKING -> PACKED
 * -> READY_FOR_DELIVERY. Hai buoc xac nhan va bat dau soan duoc kho thuc hien
 * trong mot transaction de don khong bi ket o trang thai trung gian.
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
    let parsedStatus: OrderStatus | undefined;
    if (status) {
      if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
        throw new BadRequestException({
          code: 'INVALID_ORDER_STATUS',
          message: 'Trang thai don hang khong hop le',
        });
      }
      parsedStatus = status as OrderStatus;
    }
    return this.prisma.order.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(parsedStatus ? { status: parsedStatus } : {}),
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

  /** Don cho kho xac nhan hoac dang soan cua cua hang. */
  async listOrdersToPick(user: AuthUser) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    return this.prisma.order.findMany({
      where: {
        storeId,
        status: {
          in: [
            OrderStatus.PLACED,
            OrderStatus.STORE_CONFIRMED,
            OrderStatus.PICKING,
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        user: { include: { profile: true } },
      },
    });
  }

  /** Lich su don da roi hang doi xu ly cua kho. */
  async listProcessedWarehouseOrders(user: AuthUser) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    return this.prisma.order.findMany({
      where: {
        storeId,
        status: {
          in: [
            OrderStatus.PACKED,
            OrderStatus.READY_FOR_DELIVERY,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
            OrderStatus.COMPLETED,
            OrderStatus.CANCELLED,
            OrderStatus.DELIVERY_FAILED,
            OrderStatus.RETURN_REQUESTED,
            OrderStatus.RETURNED,
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: true,
        user: { include: { profile: true } },
      },
      take: 200,
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

  /**
   * Kho xac nhan du hang va bat dau soan trong mot transaction:
   * PLACED -> STORE_CONFIRMED -> PICKING.
   * Chap nhan STORE_CONFIRMED de xu ly cac don cu dang o trang thai trung gian.
   */
  async confirmAndStartPicking(user: AuthUser, orderId: string) {
    const order = (await this.scope.getOrderInScope(
      user.id,
      user.roles,
      orderId,
    )) as { id: string; status: OrderStatus; storeId: string };
    if (
      order.status !== OrderStatus.PLACED &&
      order.status !== OrderStatus.STORE_CONFIRMED
    ) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Don dang o trang thai ${order.status}, khong the xac nhan de soan`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (order.status === OrderStatus.PLACED) {
        await this.transitionInTx(
          tx,
          orderId,
          OrderStatus.PLACED,
          OrderStatus.STORE_CONFIRMED,
          user.id,
          'Kho xac nhan du hang',
        );
      }
      await this.transitionInTx(
        tx,
        orderId,
        OrderStatus.STORE_CONFIRMED,
        OrderStatus.PICKING,
        user.id,
        'Kho xac nhan va bat dau soan hang',
      );
      await this.audit.log(
        {
          action: 'WAREHOUSE_ORDER_CONFIRMED',
          actorId: user.id,
          targetType: 'Order',
          targetId: orderId,
          storeId: order.storeId,
        },
        tx,
      );
    });
    this.events.emit('order.status_changed', {
      orderId,
      status: OrderStatus.PICKING,
    });
    return this.getStoreOrder(user, orderId);
  }

  /**
   * Dong goi va ban giao shipper atomically:
   * PICKING -> PACKED -> READY_FOR_DELIVERY.
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
    const scopedOrder = order as unknown as {
      status: OrderStatus;
      items: { id: string; quantity: Prisma.Decimal }[];
    };
    if (scopedOrder.status !== OrderStatus.PICKING) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Chi don dang soan (PICKING) moi co the dong goi',
      });
    }
    if (pickedItems) {
      const quantityByItem = new Map(
        scopedOrder.items.map((item) => [item.id, Number(item.quantity)]),
      );
      const seen = new Set<string>();
      for (const picked of pickedItems) {
        const orderedQuantity = quantityByItem.get(picked.orderItemId);
        if (
          orderedQuantity === undefined ||
          seen.has(picked.orderItemId) ||
          !Number.isFinite(picked.quantityPicked) ||
          picked.quantityPicked <= 0 ||
          picked.quantityPicked > orderedQuantity
        ) {
          throw new BadRequestException({
            code: 'INVALID_PICKED_ITEM',
            message: 'San pham hoac so luong soan khong thuoc don hang',
          });
        }
        seen.add(picked.orderItemId);
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.assertOrderBatchesSellable(tx, orderId);
      if (pickedItems) {
        for (const p of pickedItems) {
          const updated = await tx.orderItem.updateMany({
            where: { id: p.orderItemId, orderId },
            data: { quantityPicked: p.quantityPicked },
          });
          if (updated.count !== 1) {
            throw new BadRequestException({
              code: 'PICKED_ITEM_CHANGED',
              message: 'San pham trong don da thay doi, vui long tai lai',
            });
          }
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
      await this.transitionInTx(
        tx,
        orderId,
        OrderStatus.PACKED,
        OrderStatus.READY_FOR_DELIVERY,
        user.id,
        'Kho da dong goi, san sang giao shipper',
      );
    });
    this.events.emit('order.packed', { orderId });
    return this.getStoreOrder(user, orderId);
  }

  /** Huy don tu phia quan ly/cua hang. */
  async cancelByStore(user: AuthUser, orderId: string, reason: string) {
    return this.cancelInScope(
      user,
      orderId,
      reason,
      [
        OrderStatus.PLACED,
        OrderStatus.STORE_CONFIRMED,
        OrderStatus.PICKING,
        OrderStatus.PACKED,
        OrderStatus.READY_FOR_DELIVERY,
      ],
      'ORDER_CANCELLED',
      'store',
    );
  }

  /** Kho bao thieu hang trong luc xac nhan/soan: huy don va nha ton da giu. */
  async reportShortage(user: AuthUser, orderId: string, reason: string) {
    return this.cancelInScope(
      user,
      orderId,
      reason,
      [OrderStatus.PLACED, OrderStatus.STORE_CONFIRMED, OrderStatus.PICKING],
      'ORDER_SHORTAGE_REPORTED',
      'warehouse_shortage',
    );
  }

  private async cancelInScope(
    user: AuthUser,
    orderId: string,
    reason: string,
    cancellable: OrderStatus[],
    auditAction: string,
    source: 'store' | 'warehouse_shortage',
  ) {
    const normalizedReason = reason?.trim();
    if (!normalizedReason || normalizedReason.length < 3 || normalizedReason.length > 500) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'Vui long ghi ro ly do (tu 3 den 500 ky tu)',
      });
    }
    const order = (await this.scope.getOrderInScope(
      user.id,
      user.roles,
      orderId,
    )) as { id: string; status: OrderStatus; storeId: string; grandTotal: number };
    if (!cancellable.includes(order.status)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_CANCELLABLE',
        message: 'Don khong the huy o trang thai hien tai',
      });
    }

    let refundPending = false;
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.releaseForOrder(tx, orderId, user.id);
      await this.transitionInTx(
        tx,
        orderId,
        order.status,
        OrderStatus.CANCELLED,
        user.id,
        normalizedReason,
      );

      await tx.delivery.updateMany({
        where: { orderId, status: DeliveryStatus.ASSIGNED },
        data: {
          status: DeliveryStatus.FAILED,
          failureReason: normalizedReason,
        },
      });
      await tx.payment.updateMany({
        where: {
          orderId,
          status: { in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
        },
        data: { status: PaymentStatus.CANCELLED },
      });

      const paidPayment = await tx.payment.findFirst({
        where: { orderId, status: PaymentStatus.SUCCESS },
        orderBy: { createdAt: 'desc' },
      });
      if (paidPayment) {
        await tx.refund.create({
          data: {
            paymentId: paidPayment.id,
            orderId,
            amount: order.grandTotal,
            status: 'PENDING',
            reason: normalizedReason,
          },
        });
        await tx.payment.update({
          where: { id: paidPayment.id },
          data: { status: PaymentStatus.REFUND_PENDING },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: PaymentStatus.REFUND_PENDING },
        });
        refundPending = true;
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: PaymentStatus.CANCELLED },
        });
      }

      await tx.auditLog.create({
        data: {
          action: auditAction,
          actorId: user.id,
          targetType: 'Order',
          targetId: orderId,
          storeId: order.storeId,
          metadata: { reason: normalizedReason, source, refundPending },
        },
      });
    });
    this.events.emit('order.cancelled', {
      orderId,
      reason: normalizedReason,
      source,
      refundPending,
    });
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
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: from },
      data: { status: to },
    });
    if (updated.count !== 1) {
      throw new BadRequestException({
        code: 'ORDER_STATUS_CHANGED',
        message: 'Trang thai don da thay doi, vui long tai lai va thu lai',
      });
    }
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: from, toStatus: to, actorId, reason },
    });
  }
}
