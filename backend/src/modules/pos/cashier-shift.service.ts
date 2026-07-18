import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashierShiftStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreScopeService } from '../store/store-scope.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Quan ly ca ban hang (CashierShift) cua thu ngan.
 * - Mot cashier chi co toi da 1 ca OPEN tai 1 thoi diem.
 * - Open: ghi opening cash.
 * - Close: nhap counted cash -> tinh cashDifference = counted - expected.
 * - expectedCash duoc cong don boi cac payment tien mat (POSSaleService).
 */
@Injectable()
export class CashierShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: StoreScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Ca OPEN hien tai cua cashier (neu co). */
  async getCurrent(user: AuthUser, requestedStoreId?: string) {
    const storeId = await this.scope.resolveOperationalStoreId(user, requestedStoreId);
    const shift = await this.prisma.cashierShift.findFirst({
      where: { cashierId: user.id, storeId, status: CashierShiftStatus.OPEN },
      orderBy: { openedAt: 'desc' },
      include: { store: { select: { id: true, name: true, code: true } } },
    });
    if (!shift) return null;
    return this.enrich(shift.id);
  }

  /** Mo ca moi. Yeu cau cashier thuoc mot store. Chan neu da co ca OPEN. */
  async openShift(user: AuthUser, openingCash: number, note?: string, requestedStoreId?: string) {
    const storeId = await this.scope.resolveOperationalStoreId(user, requestedStoreId);
    const existing = await this.prisma.cashierShift.findFirst({
      where: { cashierId: user.id, storeId, status: CashierShiftStatus.OPEN },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SHIFT_ALREADY_OPEN',
        message: 'Ban dang co mot ca ban hang chua dong',
      });
    }
    const shift = await this.prisma.cashierShift.create({
      data: {
        storeId,
        cashierId: user.id,
        openingCash: Math.max(0, Math.round(openingCash || 0)),
        expectedCash: Math.max(0, Math.round(openingCash || 0)),
        note,
      },
    });
    await this.audit.log({
      action: 'POS_SHIFT_OPENED',
      actorId: user.id,
      targetType: 'CashierShift',
      targetId: shift.id,
      storeId,
      metadata: { openingCash: shift.openingCash },
    });
    return this.enrich(shift.id);
  }

  /** Dong ca: nhap counted cash, tinh chenh lech. Chan neu con sale DRAFT/HELD. */
  async closeShift(user: AuthUser, countedCash: number, note?: string, requestedStoreId?: string) {
    const storeId = await this.scope.resolveOperationalStoreId(user, requestedStoreId);
    const shift = await this.prisma.cashierShift.findFirst({
      where: { cashierId: user.id, storeId, status: CashierShiftStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });
    if (!shift) {
      throw new NotFoundException({
        code: 'NO_OPEN_SHIFT',
        message: 'Khong co ca ban hang nao dang mo',
      });
    }
    const openDrafts = await this.prisma.pOSSale.count({
      where: { shiftId: shift.id, status: { in: ['DRAFT', 'HELD'] } },
    });
    if (openDrafts > 0) {
      throw new BadRequestException({
        code: 'SHIFT_HAS_OPEN_SALES',
        message: `Con ${openDrafts} hoa don chua thanh toan/treo. Vui long xu ly truoc khi dong ca`,
      });
    }
    const counted = Math.max(0, Math.round(countedCash || 0));
    const diff = counted - shift.expectedCash;
    const closed = await this.prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        status: CashierShiftStatus.CLOSED,
        closedAt: new Date(),
        countedCash: counted,
        cashDifference: diff,
        note: note ?? shift.note,
      },
    });
    await this.audit.log({
      action: 'POS_SHIFT_CLOSED',
      actorId: user.id,
      targetType: 'CashierShift',
      targetId: shift.id,
      storeId: shift.storeId,
      metadata: {
        openingCash: shift.openingCash,
        expectedCash: shift.expectedCash,
        countedCash: counted,
        cashDifference: diff,
      },
    });
    return this.enrich(closed.id);
  }

  /**
   * Lay (hoac tu dong tao) ca OPEN cho cashier de gan vao sale.
   * MVP cho phep tu tao ca neu cashier chua mo, de don gian luong ban.
   */
  async ensureOpenShift(
    tx: Prisma.TransactionClient,
    cashierId: string,
    storeId: string,
  ): Promise<string> {
    const existing = await tx.cashierShift.findFirst({
      where: { cashierId, storeId, status: CashierShiftStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });
    if (existing) return existing.id;
    const created = await tx.cashierShift.create({
      data: { storeId, cashierId, openingCash: 0, expectedCash: 0 },
    });
    return created.id;
  }

  /** Bao cao chi tiet cac ca trong store cua manager. */
  async listShiftsForStore(user: AuthUser, storeId: string) {
    await this.scope.assertStoreAccess(user.id, user.roles, storeId);
    const shifts = await this.prisma.cashierShift.findMany({
      where: { storeId },
      orderBy: { openedAt: 'desc' },
      take: 100,
      include: {
        cashier: { include: { profile: true } },
        _count: { select: { sales: true } },
      },
    });
    return shifts.map((s) => ({
      id: s.id,
      cashierId: s.cashierId,
      cashierName: s.cashier.profile?.fullName ?? s.cashier.email,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingCash: s.openingCash,
      expectedCash: s.expectedCash,
      countedCash: s.countedCash,
      cashDifference: s.cashDifference,
      saleCount: s._count.sales,
    }));
  }

  /** Lay shift + tong hop doanh thu cac sale PAID trong ca. */
  private async enrich(shiftId: string) {
    const shift = await this.prisma.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        store: { select: { id: true, name: true, code: true } },
        cashier: { include: { profile: true } },
      },
    });
    if (!shift) return null;
    const agg = await this.prisma.pOSSale.aggregate({
      where: { shiftId, status: 'PAID' },
      _sum: { grandTotal: true },
      _count: true,
    });
    return {
      id: shift.id,
      storeId: shift.storeId,
      storeName: shift.store.name,
      cashierId: shift.cashierId,
      cashierName: shift.cashier.profile?.fullName ?? shift.cashier.email,
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingCash: shift.openingCash,
      expectedCash: shift.expectedCash,
      countedCash: shift.countedCash,
      cashDifference: shift.cashDifference,
      paidSaleCount: agg._count,
      paidRevenue: agg._sum.grandTotal ?? 0,
      note: shift.note,
    };
  }
}
