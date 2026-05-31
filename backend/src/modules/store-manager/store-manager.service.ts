import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreScopeService } from '../store/store-scope.service';
import { StoreInventoryService } from '../inventory/inventory.service';
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
  ) {}

  private async resolveStoreId(user: AuthUser): Promise<string> {
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

  async getStore(user: AuthUser) {
    const storeId = await this.resolveStoreId(user);
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

  async dashboard(user: AuthUser) {
    const storeId = await this.resolveStoreId(user);
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
        select: { name: true, code: true, status: true },
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

  async listStaff(user: AuthUser) {
    const storeId = await this.resolveStoreId(user);
    const staff = await this.prisma.storeStaff.findMany({
      where: { storeId },
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

  async listInventory(user: AuthUser, q?: string, lowStockOnly?: boolean) {
    const storeId = await this.resolveStoreId(user);
    return this.inventory.listInventory(storeId, { q, lowStockOnly });
  }

  async updateStoreStatus(user: AuthUser, status: string) {
    const storeId = await this.resolveStoreId(user);
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

  async reports(user: AuthUser) {
    const storeId = await this.resolveStoreId(user);
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
}
