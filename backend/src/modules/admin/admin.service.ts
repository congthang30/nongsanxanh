import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AssignManagerDto,
  AssignShipperDto,
  CreateServiceAreaDto,
  CreateStoreDto,
  UpdateStoreDto,
} from './dto/admin.dto';

/**
 * Admin service cho mo hinh chuoi cua hang.
 * Quan ly stores, service areas, gan manager/shipper, users/roles,
 * products, inventory theo store, reports toan chuoi.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ============ Dashboard ============

  async summary() {
    const [totalOrders, totalStores, pendingOrders, deliveryFailed, totalUsers, revenueAgg] =
      await this.prisma.$transaction([
        this.prisma.order.count(),
        this.prisma.store.count({ where: { status: 'ACTIVE' } }),
        this.prisma.order.count({
          where: {
            status: {
              in: [
                OrderStatus.PLACED,
                OrderStatus.STORE_CONFIRMED,
                OrderStatus.PICKING,
                OrderStatus.PACKED,
              ],
            },
          },
        }),
        this.prisma.order.count({ where: { status: OrderStatus.DELIVERY_FAILED } }),
        this.prisma.user.count(),
        this.prisma.order.aggregate({
          where: {
            status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          },
          _sum: { grandTotal: true },
        }),
      ]);

    const lowStockStores = await this.prisma.storeInventory.findMany({
      where: { status: 'ACTIVE' },
      select: {
        storeId: true,
        quantityOnHand: true,
        reservedQuantity: true,
        lowStockThreshold: true,
      },
    });
    const lowStockStoreIds = new Set(
      lowStockStores
        .filter(
          (s) =>
            Number(s.quantityOnHand) - Number(s.reservedQuantity) <=
            Number(s.lowStockThreshold),
        )
        .map((s) => s.storeId),
    );

    return {
      totalOrders,
      totalStores,
      pendingOrders,
      deliveryFailed,
      totalUsers,
      revenue: revenueAgg._sum.grandTotal ?? 0,
      lowStockStoreCount: lowStockStoreIds.size,
    };
  }

  // ============ Stores ============

  async listStores() {
    const stores = await this.prisma.store.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        manager: { include: { profile: true } },
        primaryShipper: { include: { profile: true } },
        serviceAreas: { where: { status: 'ACTIVE' } },
        _count: { select: { staff: true, orders: true } },
      },
    });
    return stores.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      slug: s.slug,
      status: s.status,
      province: s.province,
      district: s.district,
      manager: s.manager
        ? { id: s.manager.id, name: s.manager.profile?.fullName ?? s.manager.email }
        : null,
      primaryShipper: s.primaryShipper
        ? {
            id: s.primaryShipper.id,
            name: s.primaryShipper.profile?.fullName ?? s.primaryShipper.email,
          }
        : null,
      serviceAreaCount: s.serviceAreas.length,
      staffCount: s._count.staff,
      orderCount: s._count.orders,
    }));
  }

  async getStore(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        manager: { include: { profile: true } },
        primaryShipper: { include: { profile: true } },
        serviceAreas: true,
        staff: { include: { user: { include: { profile: true } } } },
        _count: { select: { orders: true, inventory: true } },
      },
    });
    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'Khong tim thay cua hang',
      });
    }
    return store;
  }

  async createStore(dto: CreateStoreDto, actorId: string) {
    const existing = await this.prisma.store.findFirst({
      where: { OR: [{ code: dto.code }, { slug: dto.slug }] },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'STORE_EXISTS',
        message: 'Ma hoac slug cua hang da ton tai',
      });
    }
    const store = await this.prisma.store.create({
      data: {
        code: dto.code,
        name: dto.name,
        slug: dto.slug,
        phone: dto.phone,
        email: dto.email,
        addressLine: dto.addressLine,
        formattedAddress: dto.formattedAddress,
        province: dto.province,
        district: dto.district,
        ward: dto.ward,
        lat: dto.lat,
        lng: dto.lng,
        serviceRadiusKm: dto.serviceRadiusKm,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        status: 'ACTIVE',
      },
    });
    await this.audit.log({
      action: 'STORE_CREATED',
      actorId,
      targetType: 'Store',
      targetId: store.id,
      storeId: store.id,
      metadata: { name: store.name, code: store.code },
    });
    return store;
  }

  async updateStore(id: string, dto: UpdateStoreDto, actorId: string) {
    await this.assertStoreExists(id);
    const store = await this.prisma.store.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        addressLine: dto.addressLine,
        formattedAddress: dto.formattedAddress,
        province: dto.province,
        district: dto.district,
        ward: dto.ward,
        lat: dto.lat,
        lng: dto.lng,
        serviceRadiusKm: dto.serviceRadiusKm,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        status: dto.status as never,
      },
    });
    await this.audit.log({
      action: 'STORE_UPDATED',
      actorId,
      targetType: 'Store',
      targetId: id,
      storeId: id,
    });
    return store;
  }

  // ============ Service areas ============

  async addServiceArea(storeId: string, dto: CreateServiceAreaDto, actorId: string) {
    await this.assertStoreExists(storeId);
    const area = await this.prisma.storeServiceArea.create({
      data: {
        storeId,
        province: dto.province,
        district: dto.district,
        ward: dto.ward,
        radiusKm: dto.radiusKm,
        priority: dto.priority ?? 0,
        status: 'ACTIVE',
      },
    });
    await this.audit.log({
      action: 'SERVICE_AREA_ADDED',
      actorId,
      targetType: 'StoreServiceArea',
      targetId: area.id,
      storeId,
      metadata: { province: dto.province, district: dto.district, ward: dto.ward },
    });
    return area;
  }

  async removeServiceArea(storeId: string, areaId: string, actorId: string) {
    const area = await this.prisma.storeServiceArea.findFirst({
      where: { id: areaId, storeId },
    });
    if (!area) {
      throw new NotFoundException({
        code: 'AREA_NOT_FOUND',
        message: 'Khong tim thay khu vuc phuc vu',
      });
    }
    await this.prisma.storeServiceArea.delete({ where: { id: areaId } });
    await this.audit.log({
      action: 'SERVICE_AREA_REMOVED',
      actorId,
      targetType: 'StoreServiceArea',
      targetId: areaId,
      storeId,
    });
    return { message: 'Da xoa khu vuc phuc vu' };
  }

  // ============ Assign manager / shipper ============

  async assignManager(storeId: string, dto: AssignManagerDto, actorId: string) {
    await this.assertStoreExists(storeId);
    await this.assertUserHasRole(dto.userId, ROLE.STORE_MANAGER);

    await this.prisma.$transaction(async (tx) => {
      // Go manager cu khoi store khac neu user nay dang quan ly store khac
      await tx.store.updateMany({
        where: { managerId: dto.userId },
        data: { managerId: null },
      });
      await tx.store.update({
        where: { id: storeId },
        data: { managerId: dto.userId },
      });
      // StoreStaff membership
      await tx.storeStaff.upsert({
        where: { storeId_userId: { storeId, userId: dto.userId } },
        create: {
          storeId,
          userId: dto.userId,
          role: 'STORE_MANAGER',
          status: 'ACTIVE',
        },
        update: { role: 'STORE_MANAGER', status: 'ACTIVE' },
      });
      await this.audit.log(
        {
          action: 'STORE_MANAGER_ASSIGNED',
          actorId,
          targetType: 'Store',
          targetId: storeId,
          storeId,
          metadata: { managerId: dto.userId },
        },
        tx,
      );
    });
    return this.getStore(storeId);
  }

  async assignShipper(storeId: string, dto: AssignShipperDto, actorId: string) {
    await this.assertStoreExists(storeId);
    await this.assertUserHasRole(dto.userId, ROLE.SHIPPER);

    await this.prisma.$transaction(async (tx) => {
      await tx.store.updateMany({
        where: { primaryShipperId: dto.userId },
        data: { primaryShipperId: null },
      });
      await tx.store.update({
        where: { id: storeId },
        data: { primaryShipperId: dto.userId },
      });
      await tx.storeStaff.upsert({
        where: { storeId_userId: { storeId, userId: dto.userId } },
        create: {
          storeId,
          userId: dto.userId,
          role: 'SHIPPER',
          status: 'ACTIVE',
        },
        update: { role: 'SHIPPER', status: 'ACTIVE' },
      });
      await this.audit.log(
        {
          action: 'STORE_SHIPPER_ASSIGNED',
          actorId,
          targetType: 'Store',
          targetId: storeId,
          storeId,
          metadata: { shipperId: dto.userId },
        },
        tx,
      );
    });
    return this.getStore(storeId);
  }

  /** Them nhan vien (staff/warehouse) vao store. */
  async addStaff(
    storeId: string,
    userId: string,
    role: 'STORE_STAFF' | 'WAREHOUSE_STAFF',
    actorId: string,
  ) {
    await this.assertStoreExists(storeId);
    const roleCode = role === 'STORE_STAFF' ? ROLE.STORE_STAFF : ROLE.WAREHOUSE_STAFF;
    await this.assertUserHasRole(userId, roleCode);
    const staff = await this.prisma.storeStaff.upsert({
      where: { storeId_userId: { storeId, userId } },
      create: { storeId, userId, role, status: 'ACTIVE' },
      update: { role, status: 'ACTIVE' },
    });
    await this.audit.log({
      action: 'STORE_STAFF_ADDED',
      actorId,
      targetType: 'StoreStaff',
      targetId: staff.id,
      storeId,
      metadata: { userId, role },
    });
    return staff;
  }

  // ============ Users / roles ============

  listUsers(role?: string) {
    return this.prisma.user.findMany({
      where: role
        ? { userRoles: { some: { role: { code: role } } } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        profile: { select: { fullName: true } },
        userRoles: { include: { role: { select: { code: true } } } },
        storeMemberships: {
          where: { status: 'ACTIVE' },
          include: { store: { select: { name: true } } },
        },
      },
    });
  }

  async setUserRoles(userId: string, roleCodes: string[], actorId: string) {
    const roles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      for (const r of roles) {
        await tx.userRole.create({ data: { userId, roleId: r.id } });
      }
    });
    await this.audit.log({
      action: 'USER_ROLES_UPDATED',
      actorId,
      targetType: 'User',
      targetId: userId,
      metadata: { roles: roleCodes },
    });
    return { message: 'Da cap nhat role', roles: roleCodes };
  }

  async setUserStatus(id: string, status: 'ACTIVE' | 'LOCKED', actorId: string) {
    await this.prisma.user.update({ where: { id }, data: { status } });
    await this.audit.log({
      action: 'USER_STATUS_CHANGED',
      actorId,
      targetType: 'User',
      targetId: id,
      metadata: { status },
    });
    return { message: 'Da cap nhat trang thai user' };
  }

  // ============ Inventory by store ============

  async inventoryByStore(storeId: string) {
    const rows = await this.prisma.storeInventory.findMany({
      where: { storeId },
      include: {
        variant: { include: { product: { select: { name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      variantId: r.variantId,
      sku: r.variant.sku,
      productName: r.variant.product.name,
      unit: r.variant.unit,
      quantityOnHand: Number(r.quantityOnHand),
      reservedQuantity: Number(r.reservedQuantity),
      available: Number(r.quantityOnHand) - Number(r.reservedQuantity),
      lowStockThreshold: Number(r.lowStockThreshold),
      status: r.status,
    }));
  }

  // ============ Reports ============

  async revenueReport(days = 30) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      },
      select: { grandTotal: true, createdAt: true, storeId: true },
    });
    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { revenue: 0, orders: 0 };
      cur.revenue += o.grandTotal;
      cur.orders += 1;
      byDay.set(key, cur);
    }
    const totalRevenue = orders.reduce((s, o) => s + o.grandTotal, 0);
    return {
      periodDays: days,
      totalRevenue,
      orderCount: orders.length,
      aov: orders.length ? Math.round(totalRevenue / orders.length) : 0,
      revenueByDay: Array.from(byDay.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async storeReport() {
    const stores = await this.prisma.store.findMany({
      include: { _count: { select: { orders: true } } },
    });
    const result: {
      storeId: string;
      name: string;
      code: string;
      status: string;
      totalOrders: number;
      completedOrders: number;
      revenue: number;
    }[] = [];
    for (const store of stores) {
      const agg = await this.prisma.order.aggregate({
        where: {
          storeId: store.id,
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        },
        _sum: { grandTotal: true },
        _count: true,
      });
      result.push({
        storeId: store.id,
        name: store.name,
        code: store.code,
        status: store.status,
        totalOrders: store._count.orders,
        completedOrders: agg._count,
        revenue: agg._sum.grandTotal ?? 0,
      });
    }
    return result;
  }

  listAuditLogs(action?: string) {
    return this.audit.list({ action });
  }

  // ============ helpers ============

  private async assertStoreExists(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'Khong tim thay cua hang',
      });
    }
  }

  private async assertUserHasRole(userId: string, roleCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Khong tim thay nguoi dung',
      });
    }
    const hasRole = user.userRoles.some((ur) => ur.role.code === roleCode);
    if (!hasRole) {
      // Tu dong gan role neu chua co (admin gan nhan su)
      const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
      if (role) {
        await this.prisma.userRole.upsert({
          where: { userId_roleId: { userId, roleId: role.id } },
          create: { userId, roleId: role.id },
          update: {},
        });
      }
    }
  }
}
