import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { InventoryTxType, OrderStatus, PaymentStatus, Prisma, StoreStaffStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ROLE } from '../../common/constants/roles.constant';
import { StoreInventoryService } from '../inventory/inventory.service';
import { NotificationService } from '../notification/notification.service';
import { AdjustStockDto, ExportStockDto, ImportStockDto } from '../warehouse/dto/warehouse.dto';
import {
  AssignManagerDto,
  AssignShipperDto,
  CreateServiceAreaDto,
  CreateStaffAccountDto,
  CreateStoreDto,
  UpdateStaffAccountDto,
  UpdateStoreDto,
  UpdateStoreStaffDto,
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
    private readonly inventory: StoreInventoryService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  // ============ Dashboard ============

  async summary(storeId?: string) {
    const orderScope: Prisma.OrderWhereInput = storeId ? { storeId } : {};
    const [totalOrders, totalStores, pendingOrders, deliveryFailed, totalUsers, revenueAgg] =
      await this.prisma.$transaction([
        this.prisma.order.count({ where: orderScope }),
        this.prisma.store.count({
          where: { status: 'ACTIVE', ...(storeId ? { id: storeId } : {}) },
        }),
        this.prisma.order.count({
          where: {
            ...orderScope,
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
        this.prisma.order.count({
          where: { ...orderScope, status: OrderStatus.DELIVERY_FAILED },
        }),
        this.prisma.user.count({
          where: storeId
            ? { storeMemberships: { some: { storeId, status: 'ACTIVE' } } }
            : {},
        }),
        this.prisma.order.aggregate({
          where: {
            ...orderScope,
            status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          },
          _sum: { grandTotal: true },
        }),
      ]);

    const lowStockStores = await this.prisma.storeInventory.findMany({
      where: { status: 'ACTIVE', ...(storeId ? { storeId } : {}) },
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

  async closeStore(id: string, actorId: string) {
    await this.assertStoreExists(id);
    const activeOrders = await this.prisma.order.count({
      where: {
        storeId: id,
        status: {
          notIn: [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.COMPLETED],
        },
      },
    });
    if (activeOrders > 0) {
      throw new BadRequestException({
        code: 'STORE_HAS_ACTIVE_ORDERS',
        message: 'Khong the dong cua hang khi con don dang xu ly',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.store.update({
        where: { id },
        data: {
          status: 'CLOSED',
          managerId: null,
          primaryShipperId: null,
        },
      });
      await tx.storeStaff.updateMany({
        where: { storeId: id, status: { not: 'INACTIVE' } },
        data: { status: 'INACTIVE', leftAt: new Date() },
      });
      await this.audit.log(
        {
          action: 'STORE_CLOSED',
          actorId,
          targetType: 'Store',
          targetId: id,
          storeId: id,
        },
        tx,
      );
    });
    return { message: 'Da dong cua hang' };
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

  async updateStaff(
    storeId: string,
    staffId: string,
    dto: UpdateStoreStaffDto,
    actorId: string,
  ) {
    const existing = await this.prisma.storeStaff.findFirst({
      where: { id: staffId, storeId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'STORE_STAFF_NOT_FOUND',
        message: 'Khong tim thay nhan vien trong cua hang',
      });
    }
    if (existing.role === 'STORE_MANAGER' || existing.role === 'SHIPPER') {
      throw new BadRequestException({
        code: 'STAFF_MANAGED_SEPARATELY',
        message: 'Quan ly va shipper chinh phai cap nhat bang chuc nang gan rieng',
      });
    }
    if (dto.role) {
      const roleCode =
        dto.role === 'STORE_STAFF' ? ROLE.STORE_STAFF : ROLE.WAREHOUSE_STAFF;
      await this.assertUserHasRole(existing.userId, roleCode);
    }
    const status = dto.status as StoreStaffStatus | undefined;
    const staff = await this.prisma.storeStaff.update({
      where: { id: staffId },
      data: {
        role: dto.role,
        status,
        leftAt:
          status === StoreStaffStatus.ACTIVE
            ? null
            : status === StoreStaffStatus.INACTIVE
              ? new Date()
              : undefined,
      },
    });
    await this.audit.log({
      action: 'STORE_STAFF_UPDATED',
      actorId,
      targetType: 'StoreStaff',
      targetId: staffId,
      storeId,
      metadata: { role: dto.role, status: dto.status },
    });
    return staff;
  }

  async removeStaff(storeId: string, staffId: string, actorId: string) {
    const existing = await this.prisma.storeStaff.findFirst({
      where: { id: staffId, storeId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'STORE_STAFF_NOT_FOUND',
        message: 'Khong tim thay nhan vien trong cua hang',
      });
    }
    if (existing.role === 'STORE_MANAGER' || existing.role === 'SHIPPER') {
      throw new BadRequestException({
        code: 'STAFF_MANAGED_SEPARATELY',
        message: 'Quan ly va shipper chinh phai cap nhat bang chuc nang gan rieng',
      });
    }
    await this.prisma.storeStaff.update({
      where: { id: staffId },
      data: { status: StoreStaffStatus.INACTIVE, leftAt: new Date() },
    });
    await this.audit.log({
      action: 'STORE_STAFF_REMOVED',
      actorId,
      targetType: 'StoreStaff',
      targetId: staffId,
      storeId,
      metadata: { userId: existing.userId, role: existing.role },
    });
    return { message: 'Da go nhan vien khoi cua hang' };
  }

  // ============ Users / roles ============

  listCustomers(filter: { storeId?: string; status?: string; q?: string }) {
    const where: Prisma.UserWhereInput = {
      userRoles: { some: { role: { code: ROLE.CUSTOMER } } },
      ...(filter.status ? { status: filter.status as never } : {}),
      ...(filter.storeId ? { orders: { some: { storeId: filter.storeId } } } : {}),
      ...(filter.q
        ? {
            OR: [
              { email: { contains: filter.q, mode: 'insensitive' } },
              { phone: { contains: filter.q } },
              { profile: { fullName: { contains: filter.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        profile: { select: { fullName: true, avatarUrl: true } },
        _count: { select: { orders: true } },
      },
    });
  }

  listUsers(filter: { role?: string; storeId?: string }) {
    const where: Prisma.UserWhereInput = {};
    if (filter.role) {
      where.userRoles = { some: { role: { code: filter.role } } };
    }
    if (filter.storeId) {
      where.storeMemberships = {
        some: { storeId: filter.storeId, status: 'ACTIVE' },
      };
    }
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        profile: { select: { fullName: true } },
        userRoles: { include: { role: { select: { code: true } } } },
        storeMemberships: {
          where: { status: 'ACTIVE' },
          include: { store: { select: { id: true, name: true, code: true } } },
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

  async setCustomerStatus(id: string, status: 'ACTIVE' | 'LOCKED', actorId: string) {
    const customer = await this.prisma.user.findFirst({
      where: {
        id,
        userRoles: { some: { role: { code: ROLE.CUSTOMER } } },
      },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản khách hàng',
      });
    }
    return this.setUserStatus(id, status, actorId);
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

  async listStaff(filter: { storeId?: string; status?: string }) {
    const rows = await this.prisma.storeStaff.findMany({
      where: {
        ...(filter.storeId ? { storeId: filter.storeId } : {}),
        ...(filter.status ? { status: filter.status as StoreStaffStatus } : {}),
      },
      orderBy: { joinedAt: 'desc' },
      include: {
        store: { select: { id: true, code: true, name: true, managerId: true, primaryShipperId: true } },
        user: {
          include: {
            profile: true,
            userRoles: { include: { role: { select: { code: true } } } },
          },
        },
      },
      take: 500,
    });
    return rows.map((s) => ({
      id: s.id,
      storeId: s.storeId,
      userId: s.userId,
      role: s.role,
      status: s.status,
      joinedAt: s.joinedAt,
      leftAt: s.leftAt,
      store: { id: s.store.id, code: s.store.code, name: s.store.name },
      user: {
        id: s.user.id,
        email: s.user.email,
        phone: s.user.phone,
        status: s.user.status,
        profile: s.user.profile,
        roles: s.user.userRoles.map((ur) => ur.role.code),
      },
      isStoreManager: s.store.managerId === s.userId,
      isPrimaryShipper: s.store.primaryShipperId === s.userId,
    }));
  }

  async createStaffAccount(dto: CreateStaffAccountDto, actorId: string) {
    const email = dto.email.trim().toLowerCase();
    await this.assertStoreExists(dto.storeId);
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'STAFF_ACCOUNT_EXISTS',
        message: 'Email hoặc số điện thoại đã được sử dụng',
      });
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const role = this.roleCodeForStaffRole(dto.role);
    const result = await this.prisma.$transaction(async (tx) => {
      const roleRow = await tx.role.findUnique({ where: { code: role } });
      const user = await tx.user.create({
        data: {
          email,
          phone: dto.phone || null,
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          profile: { create: { fullName: dto.fullName, avatarUrl: dto.avatarUrl } },
          userRoles: roleRow ? { create: { roleId: roleRow.id } } : undefined,
        },
        include: { profile: true },
      });
      const staff = await tx.storeStaff.create({
        data: {
          storeId: dto.storeId,
          userId: user.id,
          role: dto.role,
          status: 'ACTIVE',
        },
        include: { store: true, user: { include: { profile: true } } },
      });
      await this.applyPrimaryStaffRole(tx, dto.storeId, user.id, dto.role);
      await this.audit.log(
        {
          action: 'STAFF_ACCOUNT_CREATED',
          actorId,
          targetType: 'StoreStaff',
          targetId: staff.id,
          storeId: dto.storeId,
          metadata: { userId: user.id, role: dto.role },
        },
        tx,
      );
      return staff;
    });

    let onboardingEmailSent = true;
    try {
      const appUrl = this.config.get<string>('PUBLIC_APP_URL', 'http://localhost:5173');
      await this.notifications.sendEmail({
        to: email,
        title: 'Tài khoản nhân viên của bạn đã sẵn sàng',
        type: 'STAFF_WELCOME',
        body:
          'Xin chào ' + dto.fullName + '.\n' +
          'Bạn đã được thêm vào ' + result.store.name + '. Dùng thông tin bên dưới để đăng nhập. Sau khi đăng nhập, bạn có thể tự quản lý mật khẩu bằng chức năng Quên mật khẩu.',
        credentials: [
          { label: 'Email đăng nhập', value: email },
          { label: 'Mật khẩu tạm', value: temporaryPassword, secret: true },
          { label: 'Chi nhánh', value: result.store.name },
        ],
        action: { label: 'Đăng nhập hệ thống', url: appUrl + '/login' },
      });
    } catch {
      onboardingEmailSent = false;
    }

    return { ...result, onboardingEmailSent };
  }
  async updateStaffAccount(staffId: string, dto: UpdateStaffAccountDto, actorId: string) {
    const existing = await this.prisma.storeStaff.findUnique({
      where: { id: staffId },
      include: { user: { include: { profile: true } }, store: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'STORE_STAFF_NOT_FOUND',
        message: 'Khong tim thay nhan vien',
      });
    }
    const nextStoreId = dto.storeId ?? existing.storeId;
    const nextRole = dto.role ?? existing.role;
    const nextStatus = dto.status ? (dto.status as StoreStaffStatus) : undefined;
    if (dto.storeId && dto.storeId !== existing.storeId) {
      await this.assertStoreExists(dto.storeId);
    }

    const staff = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          phone: dto.phone === undefined ? undefined : dto.phone || null,
        },
      });
      if (dto.fullName !== undefined || dto.avatarUrl !== undefined) {
        await tx.userProfile.upsert({
          where: { userId: existing.userId },
          create: {
            userId: existing.userId,
            fullName: dto.fullName || existing.user.profile?.fullName || 'Nhan vien',
            avatarUrl: dto.avatarUrl,
          },
          update: {
            fullName: dto.fullName,
            avatarUrl: dto.avatarUrl,
          },
        });
      }
      await this.replaceStaffUserRole(tx, existing.userId, this.roleCodeForStaffRole(nextRole));
      await this.clearPrimaryStaffRole(tx, existing.storeId, existing.userId);
      const updated = await tx.storeStaff.update({
        where: { id: staffId },
        data: {
          storeId: nextStoreId,
          role: nextRole,
          status: nextStatus,
          leftAt:
            nextStatus === StoreStaffStatus.ACTIVE
              ? null
              : nextStatus === StoreStaffStatus.INACTIVE
                ? new Date()
                : undefined,
        },
        include: { store: true, user: { include: { profile: true } } },
      });
      if ((nextStatus ?? existing.status) === StoreStaffStatus.ACTIVE) {
        await this.applyPrimaryStaffRole(tx, nextStoreId, existing.userId, nextRole);
      }
      await this.audit.log(
        {
          action: 'STAFF_ACCOUNT_UPDATED',
          actorId,
          targetType: 'StoreStaff',
          targetId: staffId,
          storeId: nextStoreId,
          metadata: { role: nextRole, status: dto.status, userId: existing.userId },
        },
        tx,
      );
      return updated;
    });
    return staff;
  }

  async removeStaffAccount(staffId: string, actorId: string) {
    const existing = await this.prisma.storeStaff.findUnique({ where: { id: staffId } });
    if (!existing) {
      throw new NotFoundException({
        code: 'STORE_STAFF_NOT_FOUND',
        message: 'Khong tim thay nhan vien',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.clearPrimaryStaffRole(tx, existing.storeId, existing.userId);
      await tx.storeStaff.update({
        where: { id: staffId },
        data: { status: StoreStaffStatus.INACTIVE, leftAt: new Date() },
      });
      await this.audit.log(
        {
          action: 'STAFF_ACCOUNT_REMOVED',
          actorId,
          targetType: 'StoreStaff',
          targetId: staffId,
          storeId: existing.storeId,
          metadata: { userId: existing.userId, role: existing.role },
        },
        tx,
      );
    });
    return { message: 'Da ngung kich hoat nhan vien' };
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

  inventoryTransactions(
    storeId: string,
    filter: { variantId?: string; type?: string; from?: string; to?: string },
  ) {
    return this.inventory.listTransactions(storeId, {
      variantId: filter.variantId,
      type: filter.type ? (filter.type as InventoryTxType) : undefined,
      from: filter.from,
      to: filter.to,
    });
  }

  async importStock(storeId: string, dto: ImportStockDto, actorId: string) {
    await this.assertStoreExists(storeId);
    const result = await this.inventory.importStock(
      storeId,
      dto.variantId,
      dto.quantity,
      dto.reason,
      actorId,
    );
    await this.audit.log({
      action: 'INVENTORY_IMPORT',
      actorId,
      targetType: 'StoreInventory',
      targetId: result.id,
      storeId,
      metadata: { variantId: dto.variantId, quantity: dto.quantity, reason: dto.reason },
    });
    return result;
  }

  async adjustStock(storeId: string, dto: AdjustStockDto, actorId: string) {
    await this.assertStoreExists(storeId);
    const result = await this.inventory.adjustStock(
      storeId,
      dto.variantId,
      dto.newQuantity,
      dto.reason,
      actorId,
    );
    await this.audit.log({
      action: 'INVENTORY_ADJUST',
      actorId,
      targetType: 'StoreInventory',
      targetId: result.id,
      storeId,
      metadata: { variantId: dto.variantId, newQuantity: dto.newQuantity, reason: dto.reason },
    });
    return result;
  }

  async exportStock(storeId: string, dto: ExportStockDto, actorId: string) {
    await this.assertStoreExists(storeId);
    const kind = dto.kind ?? 'EXPORT';
    const result = await this.inventory.exportStock(
      storeId,
      dto.variantId,
      dto.quantity,
      dto.reason,
      kind,
      actorId,
    );
    await this.audit.log({
      action: kind === 'LOSS' ? 'INVENTORY_LOSS' : 'INVENTORY_EXPORT',
      actorId,
      targetType: 'StoreInventory',
      targetId: result.id,
      storeId,
      metadata: { variantId: dto.variantId, quantity: dto.quantity, reason: dto.reason, kind },
    });
    return result;
  }

  // ============ Reports ============

  async revenueReport(days = 30, storeId?: string) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        ...(storeId ? { storeId } : {}),
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

  async storeReport(storeId?: string) {
    const stores = await this.prisma.store.findMany({
      where: storeId ? { id: storeId } : undefined,
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

  listAuditLogs(action?: string, storeId?: string) {
    return this.audit.list({ action, storeId });
  }

  // ============ Reconciliation & COD (P1-02, P1-04) ============

  /**
   * P1-02: Doi soat doanh thu giua Order, Payment va POSSale theo ngay.
   * So sanh:
   *  - Online/COD: tong Order.grandTotal da SUCCESS  vs  tong Payment SUCCESS.
   *  - POS: tong POSSale PAID grandTotal             vs  tong POSPayment.
   * Tra ve cac dong lech de ke toan kiem tra. Khong sua du lieu.
   */
  async reconciliation(params?: { from?: string; to?: string; storeId?: string }) {
    const from = params?.from ? new Date(params.from) : new Date(Date.now() - 7 * 86400000);
    const to = params?.to ? new Date(params.to) : new Date();
    const range = { gte: from, lte: to };
    const storeId = params?.storeId;

    const [orderPaidAgg, paymentAgg, posSaleAgg, posPaymentAgg, refundAgg] =
      await this.prisma.$transaction([
        this.prisma.order.aggregate({
          _sum: { grandTotal: true },
          _count: true,
          where: { paymentStatus: PaymentStatus.SUCCESS, createdAt: range },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          _count: true,
          where: { status: PaymentStatus.SUCCESS, createdAt: range },
        }),
        this.prisma.pOSSale.aggregate({
          _sum: { grandTotal: true },
          _count: true,
          where: { status: 'PAID', createdAt: range },
        }),
        this.prisma.pOSPayment.aggregate({
          _sum: { amount: true },
          _count: true,
          where: { status: 'SUCCESS', createdAt: range },
        }),
        this.prisma.refund.aggregate({
          _sum: { amount: true },
          _count: true,
          where: { createdAt: range },
        }),
      ]);

    // Cac don bat thuong: order paid nhung khong co payment success, va nguoc lai.
    const paidOrdersNoPayment = await this.prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
        createdAt: range,
        ...(storeId ? { storeId } : {}),
        payments: { none: { status: PaymentStatus.SUCCESS } },
      },
      select: { id: true, orderNumber: true, grandTotal: true, storeId: true },
      take: 100,
    });
    const successPaymentsOrderNotPaid = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        createdAt: range,
        ...(storeId ? { order: { storeId } } : {}),
        order: { paymentStatus: { not: PaymentStatus.SUCCESS } },
      },
      select: {
        id: true,
        amount: true,
        orderId: true,
        order: { select: { orderNumber: true, paymentStatus: true } },
      },
      take: 100,
    });

    const onlineOrderTotal = orderPaidAgg._sum.grandTotal ?? 0;
    const paymentTotal = paymentAgg._sum.amount ?? 0;
    const posSaleTotal = posSaleAgg._sum.grandTotal ?? 0;
    const posPaymentTotal = posPaymentAgg._sum.amount ?? 0;

    return {
      range: { from, to },
      online: {
        orderPaidTotal: onlineOrderTotal,
        paymentSuccessTotal: paymentTotal,
        diff: onlineOrderTotal - paymentTotal,
        balanced: onlineOrderTotal === paymentTotal,
      },
      pos: {
        salePaidTotal: posSaleTotal,
        posPaymentTotal,
        diff: posSaleTotal - posPaymentTotal,
        balanced: posSaleTotal === posPaymentTotal,
      },
      refunds: {
        count: refundAgg._count,
        total: refundAgg._sum.amount ?? 0,
      },
      anomalies: {
        paidOrdersNoPayment,
        successPaymentsOrderNotPaid,
      },
    };
  }

  /**
   * P1-04: Danh sach don COD da giao (DELIVERED) nhung chua thu tien
   * (paymentStatus != SUCCESS). Dung de manager doi soat cong no COD.
   */
  async codOutstanding(storeId?: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        paymentMethod: 'COD',
        status: OrderStatus.DELIVERED,
        paymentStatus: { not: PaymentStatus.SUCCESS },
        ...(storeId ? { storeId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        store: { select: { id: true, name: true, code: true } },
        delivery: { select: { shipperId: true, status: true, codCollected: true } },
        user: { include: { profile: true } },
      },
      take: 300,
    });
    const totalOutstanding = orders.reduce((s, o) => s + o.grandTotal, 0);
    return { count: orders.length, totalOutstanding, orders };
  }

  // ============ helpers ============

  private generateTemporaryPassword(length = 14): string {
    const groups = [
      'ABCDEFGHJKLMNPQRSTUVWXYZ',
      'abcdefghijkmnopqrstuvwxyz',
      '23456789',
      '!@#$%*+-_',
    ];
    const all = groups.join('');
    const chars = groups.map((group) => group[randomInt(group.length)]);
    while (chars.length < length) {
      chars.push(all[randomInt(all.length)]);
    }
    for (let index = chars.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
    }
    return chars.join('');
  }

  private roleCodeForStaffRole(role: string) {
    if (role === 'STORE_MANAGER') return ROLE.STORE_MANAGER;
    if (role === 'WAREHOUSE_STAFF') return ROLE.WAREHOUSE_STAFF;
    if (role === 'SHIPPER') return ROLE.SHIPPER;
    return ROLE.STORE_STAFF;
  }

  private async replaceStaffUserRole(
    tx: Prisma.TransactionClient,
    userId: string,
    roleCode: string,
  ) {
    const staffRoles = await tx.role.findMany({
      where: {
        code: {
          in: [
            ROLE.STORE_MANAGER,
            ROLE.STORE_STAFF,
            ROLE.WAREHOUSE_STAFF,
            ROLE.SHIPPER,
          ],
        },
      },
      select: { id: true },
    });
    await tx.userRole.deleteMany({
      where: {
        userId,
        roleId: { in: staffRoles.map((role) => role.id) },
      },
    });
    await this.ensureUserRole(tx, userId, roleCode);
  }

  private async ensureUserRole(
    tx: Prisma.TransactionClient,
    userId: string,
    roleCode: string,
  ) {
    const role = await tx.role.findUnique({ where: { code: roleCode } });
    if (!role) return;
    await tx.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  private async clearPrimaryStaffRole(
    tx: Prisma.TransactionClient,
    storeId: string,
    userId: string,
  ) {
    await tx.store.updateMany({
      where: { id: storeId, managerId: userId },
      data: { managerId: null },
    });
    await tx.store.updateMany({
      where: { id: storeId, primaryShipperId: userId },
      data: { primaryShipperId: null },
    });
  }

  private async applyPrimaryStaffRole(
    tx: Prisma.TransactionClient,
    storeId: string,
    userId: string,
    role: string,
  ) {
    if (role === 'STORE_MANAGER') {
      await tx.store.updateMany({ where: { managerId: userId }, data: { managerId: null } });
      await tx.store.update({ where: { id: storeId }, data: { managerId: userId } });
    }
    if (role === 'SHIPPER') {
      await tx.store.updateMany({ where: { primaryShipperId: userId }, data: { primaryShipperId: null } });
      await tx.store.update({ where: { id: storeId }, data: { primaryShipperId: userId } });
    }
  }

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
