import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, OrderStatus, PaymentMethod, PaymentStatus, StoreStaffStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreScopeService } from '../store/store-scope.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const COMPLETED_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

/**
 * Store Manager service - quan ly cua hang cua chinh minh.
 * Dashboard, don hang, nhan vien, ton kho, bao cao. Scope theo store cua manager.
 */
@Injectable()
export class StoreManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: StoreScopeService,
    private readonly inventory: StoreInventoryService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  private async resolveStoreId(user: AuthUser, overrideStoreId?: string): Promise<string> {
    if (overrideStoreId && this.scope.isSystemAdmin(user.roles)) {
      return overrideStoreId;
    }
    // Manager: store ma user dang la STORE_MANAGER. Admin can pass nhung MVP dung store cua minh.
    const storeId = await this.scope.getUserStoreId(user.id);
    if (!storeId) {
      // Admin khong thuoc store nao -> lay store dau tien (chi de xem)
      if (this.scope.isSystemAdmin(user.roles)) {
        const first = await this.prisma.store.findFirst({
          orderBy: { createdAt: 'asc' },
        });
        if (first) return first.id;
      }
      throw new NotFoundException({
        code: 'NO_STORE',
        message: 'Tai khoan chua duoc gan cua hang',
      });
    }
    return storeId;
  }

  async getStore(user: AuthUser, overrideStoreId?: string) {
    const storeId = await this.resolveStoreId(user, overrideStoreId);
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        manager: { include: { profile: true } },
        primaryShipper: { include: { profile: true } },
        serviceAreas: { where: { status: 'ACTIVE' } },
      },
    });
    return store;
  }

  async dashboard(user: AuthUser, overrideStoreId?: string) {
    const storeId = await this.resolveStoreId(user, overrideStoreId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [byStatus, todayOrders, lowStock, store] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        where: { storeId },
        _count: true,
      }),
      this.prisma.order.findMany({
        where: { storeId, createdAt: { gte: today } },
        select: { grandTotal: true, status: true },
      }),
      this.inventory.listInventory(storeId, { lowStockOnly: true }),
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: {
          name: true,
          code: true,
          status: true,
          primaryShipper: {
            select: {
              id: true,
              email: true,
              phone: true,
              profile: { select: { fullName: true } },
            },
          },
        },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) statusMap[s.status] = s._count;

    const revenueToday = todayOrders
      .filter((o) => COMPLETED_STATUSES.includes(o.status))
      .reduce((s, o) => s + o.grandTotal, 0);

    return {
      store,
      counts: {
        new: statusMap[OrderStatus.PLACED] ?? 0,
        confirmed: statusMap[OrderStatus.STORE_CONFIRMED] ?? 0,
        picking: statusMap[OrderStatus.PICKING] ?? 0,
        packed: statusMap[OrderStatus.PACKED] ?? 0,
        readyForDelivery: statusMap[OrderStatus.READY_FOR_DELIVERY] ?? 0,
        outForDelivery: statusMap[OrderStatus.OUT_FOR_DELIVERY] ?? 0,
        delivered: statusMap[OrderStatus.DELIVERED] ?? 0,
        completed: statusMap[OrderStatus.COMPLETED] ?? 0,
        deliveryFailed: statusMap[OrderStatus.DELIVERY_FAILED] ?? 0,
      },
      ordersToday: todayOrders.length,
      revenueToday,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.slice(0, 10),
    };
  }

  async listStaff(user: AuthUser, overrideStoreId?: string) {
    const storeId = await this.resolveStoreId(user, overrideStoreId);
    const staff = await this.prisma.storeStaff.findMany({
      where: {
        storeId,
        // Quan ly xem danh sach doi ngu: khong hien chinh minh
        userId: { not: user.id },
      },
      include: { user: { include: { profile: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return staff.map((s) => ({
      id: s.id,
      userId: s.userId,
      fullName: s.user.profile?.fullName ?? s.user.email,
      email: s.user.email,
      phone: s.user.phone,
      role: s.role,
      status: s.status,
      joinedAt: s.joinedAt,
    }));
  }

  async updateStaffStatus(
    user: AuthUser,
    staffId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    overrideStoreId?: string,
  ) {
    const storeId = await this.resolveStoreId(user, overrideStoreId);
    if (!Object.values(StoreStaffStatus).includes(status as StoreStaffStatus)) {
      throw new BadRequestException({
        code: 'STAFF_STATUS_INVALID',
        message: 'Trang thai nhan vien khong hop le',
      });
    }
    const staff = await this.prisma.storeStaff.findFirst({
      where: { id: staffId, storeId },
    });
    if (!staff) {
      throw new NotFoundException({
        code: 'STORE_STAFF_NOT_FOUND',
        message: 'Khong tim thay nhan vien trong cua hang',
      });
    }
    if (staff.role === 'STORE_MANAGER' || staff.userId === user.id) {
      throw new BadRequestException({
        code: 'MANAGER_STATUS_PROTECTED',
        message: 'Quan ly khong the tu thay doi trang thai cua minh',
      });
    }

    const updated = await this.prisma.storeStaff.update({
      where: { id: staffId },
      data: {
        status: status as StoreStaffStatus,
        leftAt:
          status === StoreStaffStatus.ACTIVE
            ? null
            : status === StoreStaffStatus.INACTIVE
              ? new Date()
              : undefined,
      },
    });
    await this.audit.log({
      action: 'STORE_STAFF_STATUS_CHANGED',
      actorId: user.id,
      targetType: 'StoreStaff',
      targetId: staffId,
      storeId,
      metadata: { status },
    });
    return updated;
  }

  async listInventory(user: AuthUser, q?: string, lowStockOnly?: boolean, overrideStoreId?: string) {
    const storeId = await this.resolveStoreId(user, overrideStoreId);
    return this.inventory.listInventory(storeId, { q, lowStockOnly });
  }

  async updateStoreStatus(user: AuthUser, status: string, overrideStoreId?: string) {
    const storeId = await this.resolveStoreId(user, overrideStoreId);
    const allowed = ['ACTIVE', 'PAUSED'];
    if (!allowed.includes(status)) {
      throw new NotFoundException({
        code: 'INVALID_STATUS',
        message: 'Manager chi co the dat ACTIVE hoac PAUSED',
      });
    }
    return this.prisma.store.update({
      where: { id: storeId },
      data: { status: status as 'ACTIVE' | 'PAUSED' },
    });
  }

  async reports(user: AuthUser, overrideStoreId?: string) {
    const storeId = await this.resolveStoreId(user, overrideStoreId);
    const last7 = new Date();
    last7.setDate(last7.getDate() - 7);

    const orders = await this.prisma.order.findMany({
      where: { storeId, createdAt: { gte: last7 } },
      select: { grandTotal: true, status: true, createdAt: true },
    });

    const completed = orders.filter((o) =>
      COMPLETED_STATUSES.includes(o.status),
    );
    const revenue = completed.reduce((s, o) => s + o.grandTotal, 0);

    // Group by day
    const byDay = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, { orders: 0, revenue: 0 });
      const d = byDay.get(key)!;
      d.orders += 1;
      if (COMPLETED_STATUSES.includes(o.status)) {
        d.revenue += o.grandTotal;
      }
    }

    return {
      totalOrders: orders.length,
      completedOrders: completed.length,
      revenue,
      avgOrderValue: completed.length
        ? Math.round(revenue / completed.length)
        : 0,
      daily: Array.from(byDay.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Giao lai don sau khi shipper bao FAILED. Tao Delivery moi voi shipper chinh,
   * dua order ve READY_FOR_DELIVERY. Chi cho phep khi order DELIVERY_FAILED hoac
   * delivery hien tai dang FAILED.
   */
  async reassignDelivery(user: AuthUser, orderId: string) {
    const storeId = await this.resolveStoreId(user);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    });
    if (!order || order.storeId !== storeId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don trong cua hang',
      });
    }
    const isFailed =
      order.status === OrderStatus.DELIVERY_FAILED ||
      order.delivery?.status === DeliveryStatus.FAILED;
    if (!isFailed) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FAILED',
        message: 'Don chua o trang thai giao that bai',
      });
    }
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store?.primaryShipperId) {
      throw new BadRequestException({
        code: 'NO_PRIMARY_SHIPPER',
        message: 'Cua hang chua gan shipper chinh',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Reset delivery -> ASSIGNED voi shipper chinh
      if (order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data: {
            shipperId: store.primaryShipperId!,
            status: DeliveryStatus.ASSIGNED,
            failureReason: null,
            pickedAt: null,
            deliveredAt: null,
            events: {
              create: {
                status: DeliveryStatus.ASSIGNED,
                note: `Manager giao lai cho shipper chinh`,
                actorId: user.id,
              },
            },
          },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.READY_FOR_DELIVERY },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.READY_FOR_DELIVERY,
          actorId: user.id,
          reason: 'Manager yeu cau giao lai',
        },
      });
      await this.audit.log(
        {
          action: 'ORDER_REASSIGN_DELIVERY',
          actorId: user.id,
          targetType: 'Order',
          targetId: orderId,
          storeId,
          metadata: { newShipperId: store.primaryShipperId },
        },
        tx,
      );
    });
    this.events.emit('order.reassigned', { orderId });
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    });
  }

  /**
   * Manager huy don kem hoan ton kho. Dung khi giao that bai khong reassign duoc
   * (khach bom hang, het hang, v.v.). Inventory.releaseForOrder cong lai stock.
   */
  async cancelWithRestock(user: AuthUser, orderId: string, reason: string) {
    const storeId = await this.resolveStoreId(user);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.storeId !== storeId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don trong cua hang',
      });
    }
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException({
        code: 'ORDER_NOT_CANCELLABLE',
        message: 'Don da hoan tat hoac da huy',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.releaseForOrder(tx, orderId, user.id);
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          actorId: user.id,
          reason: reason || 'Manager huy don, hoan kho',
        },
      });
      await this.audit.log(
        {
          action: 'ORDER_CANCELLED_RESTOCK',
          actorId: user.id,
          targetType: 'Order',
          targetId: orderId,
          storeId,
          metadata: { reason },
        },
        tx,
      );
    });
    this.events.emit('order.cancelled', { orderId });
    return this.prisma.order.findUnique({
      where: { id: orderId },
    });
  }

  /**
   * P1-08: Manager xac nhan da thu tien COD cho don da giao nhung shipper chua
   * thu duoc luc giao (DELIVERED, payment con PENDING). Set payment SUCCESS +
   * order COMPLETED + delivery.codCollected = true. Co audit de doi soat.
   */
  async markCodCollected(user: AuthUser, orderId: string) {
    const storeId = await this.resolveStoreId(user);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    });
    if (!order || order.storeId !== storeId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don trong cua hang',
      });
    }
    if (order.paymentMethod !== PaymentMethod.COD) {
      throw new BadRequestException({
        code: 'NOT_COD_ORDER',
        message: 'Don nay khong phai COD',
      });
    }
    if (order.paymentStatus === PaymentStatus.SUCCESS) {
      throw new BadRequestException({
        code: 'ALREADY_PAID',
        message: 'Don nay da duoc ghi nhan thu tien',
      });
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException({
        code: 'ORDER_NOT_DELIVERED',
        message: 'Chi xac nhan thu COD cho don da giao thanh cong',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { orderId, method: 'COD' },
        data: { status: PaymentStatus.SUCCESS, paidAt: new Date() },
      });
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.SUCCESS,
          status: OrderStatus.COMPLETED,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.COMPLETED,
          actorId: user.id,
          reason: 'Manager xac nhan da thu COD',
        },
      });
      if (order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data: { codCollected: true },
        });
      }
      await this.audit.log(
        {
          action: 'COD_COLLECTED_CONFIRMED',
          actorId: user.id,
          targetType: 'Order',
          targetId: orderId,
          storeId,
          metadata: { amount: order.grandTotal },
        },
        tx,
      );
    });
    this.events.emit('order.completed', { orderId });
    return this.prisma.order.findUnique({ where: { id: orderId } });
  }
}
