import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StoreStaffRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SYSTEM_ADMIN_ROLES } from '../../common/constants/roles.constant';

/**
 * Tien ich xac dinh store ma mot user duoc phep thao tac, dung cho
 * ownership/scope checks (chong IDOR). Admin/Super Admin xem toan he thong.
 */
@Injectable()
export class StoreScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** True neu user co role toan he thong (admin/super admin). */
  isSystemAdmin(roles: string[]): boolean {
    return roles.some((r) => SYSTEM_ADMIN_ROLES.includes(r));
  }

  /**
   * Lay storeId active ma user dang la nhan vien (theo role neu can).
   * Tra ve null neu user khong thuoc store nao.
   */
  async getUserStoreId(
    userId: string,
    role?: StoreStaffRole,
  ): Promise<string | null> {
    const membership = await this.prisma.storeStaff.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        ...(role ? { role } : {}),
      },
      orderBy: { joinedAt: 'desc' },
    });
    return membership?.storeId ?? null;
  }

  /**
   * Bat buoc user phai thuoc mot store; tra storeId. Nem 403 neu khong.
   */
  async requireUserStoreId(
    userId: string,
    role?: StoreStaffRole,
  ): Promise<string> {
    const storeId = await this.getUserStoreId(userId, role);
    if (!storeId) {
      throw new ForbiddenException({
        code: 'NO_STORE_SCOPE',
        message: 'Tai khoan chua duoc gan vao cua hang nao',
      });
    }
    return storeId;
  }

  /**
   * Kiem tra user co quyen tren store cu the. Admin pass. Nhan vien phai thuoc store.
   * Nem 403 neu khong hop le.
   */
  async assertStoreAccess(
    userId: string,
    roles: string[],
    storeId: string,
    staffRole?: StoreStaffRole,
  ): Promise<void> {
    if (this.isSystemAdmin(roles)) return;
    const membership = await this.prisma.storeStaff.findFirst({
      where: {
        userId,
        storeId,
        status: 'ACTIVE',
        ...(staffRole ? { role: staffRole } : {}),
      },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'STORE_ACCESS_DENIED',
        message: 'Ban khong co quyen tren cua hang nay',
      });
    }
  }

  /**
   * Lay order va dam bao thuoc store cua user (hoac admin). Nem 404/403.
   * Tra ve order voi include tuy chon.
   */
  async getOrderInScope(
    userId: string,
    roles: string[],
    orderId: string,
    include?: object,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: include as never,
    });
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }
    if (!this.isSystemAdmin(roles)) {
      const storeId = await this.getUserStoreId(userId);
      if (!storeId || (order as { storeId: string }).storeId !== storeId) {
        throw new ForbiddenException({
          code: 'ORDER_ACCESS_DENIED',
          message: 'Don hang nay khong thuoc cua hang cua ban',
        });
      }
    }
    return order;
  }
}
