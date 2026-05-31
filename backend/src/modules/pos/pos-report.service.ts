import { Injectable } from '@nestjs/common';
import { InventoryTxType, POSSaleStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreScopeService } from '../store/store-scope.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Bao cao POS: doanh thu theo ngay/cashier, so hoa don, gia tri TB,
 * top san pham, doi soat tien mat, void/refund, ton kho giam do POS.
 * Scope theo store cua manager; admin xem theo storeId truyen vao (hoac toan he thong).
 */
@Injectable()
export class POSReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: StoreScopeService,
  ) {}

  /**
   * Xac dinh store scope cho report.
   * - Admin: dung storeId truyen vao (hoac null = toan he thong).
   * - Manager/cashier: bat buoc store cua minh.
   */
  private async resolveScope(user: AuthUser, storeId?: string): Promise<string | undefined> {
    if (this.scope.isSystemAdmin(user.roles)) {
      return storeId || undefined;
    }
    return this.scope.requireUserStoreId(user.id);
  }

  private dayRange(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date();
    if (!from) start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  /** Bao cao tong hop POS theo khoang ngay. */
  async daily(user: AuthUser, opts: { storeId?: string; from?: string; to?: string }) {
    const scopeStoreId = await this.resolveScope(user, opts.storeId);
    const { start, end } = this.dayRange(opts.from, opts.to);

    const sales = await this.prisma.pOSSale.findMany({
      where: {
        ...(scopeStoreId ? { storeId: scopeStoreId } : {}),
        createdAt: { gte: start, lte: end },
      },
      include: {
        items: true,
        cashier: { include: { profile: true } },
      },
    });

    const paid = sales.filter((s) => s.status === POSSaleStatus.PAID);
    const voided = sales.filter((s) => s.status === POSSaleStatus.VOIDED);
    const refunded = sales.filter(
      (s) =>
        s.status === POSSaleStatus.REFUNDED ||
        s.status === POSSaleStatus.PARTIAL_REFUNDED,
    );

    const revenue = paid.reduce((s, sale) => s + sale.grandTotal, 0);
    const billCount = paid.length;
    const avgBill = billCount ? Math.round(revenue / billCount) : 0;

    // Doanh thu theo ngay
    const byDay = new Map<string, { date: string; revenue: number; bills: number }>();
    for (const sale of paid) {
      const key = sale.paidAt
        ? sale.paidAt.toISOString().slice(0, 10)
        : sale.createdAt.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, { date: key, revenue: 0, bills: 0 });
      const d = byDay.get(key)!;
      d.revenue += sale.grandTotal;
      d.bills += 1;
    }

    // Doanh thu theo cashier
    const byCashier = new Map<
      string,
      { cashierId: string; cashierName: string; revenue: number; bills: number }
    >();
    for (const sale of paid) {
      if (!byCashier.has(sale.cashierId)) {
        byCashier.set(sale.cashierId, {
          cashierId: sale.cashierId,
          cashierName: sale.cashier.profile?.fullName ?? sale.cashier.email ?? 'N/A',
          revenue: 0,
          bills: 0,
        });
      }
      const c = byCashier.get(sale.cashierId)!;
      c.revenue += sale.grandTotal;
      c.bills += 1;
    }

    // Top san pham
    const byProduct = new Map<
      string,
      { name: string; sku: string; quantity: number; revenue: number }
    >();
    for (const sale of paid) {
      for (const it of sale.items) {
        const key = it.variantId;
        if (!byProduct.has(key)) {
          byProduct.set(key, {
            name: it.productNameSnapshot,
            sku: it.skuSnapshot,
            quantity: 0,
            revenue: 0,
          });
        }
        const p = byProduct.get(key)!;
        p.quantity += Number(it.quantity);
        p.revenue += it.lineTotal;
      }
    }

    // Ton kho giam do POS
    const posTx = await this.prisma.inventoryTransaction.aggregate({
      where: {
        ...(scopeStoreId ? { storeId: scopeStoreId } : {}),
        type: InventoryTxType.POS_SALE,
        createdAt: { gte: start, lte: end },
      },
      _sum: { quantity: true },
      _count: true,
    });

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      revenue,
      billCount,
      avgBillValue: avgBill,
      voidCount: voided.length,
      refundCount: refunded.length,
      inventoryReducedUnits: Number(posTx._sum.quantity ?? 0),
      inventoryTxCount: posTx._count,
      daily: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
      byCashier: Array.from(byCashier.values()).sort((a, b) => b.revenue - a.revenue),
      topProducts: Array.from(byProduct.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    };
  }

  /** Bao cao doi soat tien mat theo ca trong khoang ngay. */
  async shiftReport(user: AuthUser, opts: { storeId?: string; from?: string; to?: string }) {
    const scopeStoreId = await this.resolveScope(user, opts.storeId);
    const { start, end } = this.dayRange(opts.from, opts.to);
    const shifts = await this.prisma.cashierShift.findMany({
      where: {
        ...(scopeStoreId ? { storeId: scopeStoreId } : {}),
        openedAt: { gte: start, lte: end },
      },
      orderBy: { openedAt: 'desc' },
      include: {
        cashier: { include: { profile: true } },
        _count: { select: { sales: true } },
      },
    });
    return shifts.map((s) => ({
      id: s.id,
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

  /** Danh sach hoa don POS (manager: store minh; admin: toan he thong). */
  async listSales(
    user: AuthUser,
    opts: { storeId?: string; from?: string; to?: string; status?: string },
  ) {
    const scopeStoreId = await this.resolveScope(user, opts.storeId);
    const { start, end } = this.dayRange(opts.from, opts.to);
    const sales = await this.prisma.pOSSale.findMany({
      where: {
        ...(scopeStoreId ? { storeId: scopeStoreId } : {}),
        createdAt: { gte: start, lte: end },
        ...(opts.status ? { status: opts.status as POSSaleStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        cashier: { include: { profile: true } },
        store: { select: { name: true, code: true } },
        _count: { select: { items: true } },
      },
    });
    return sales.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      storeName: s.store.name,
      cashierName: s.cashier.profile?.fullName ?? s.cashier.email,
      status: s.status,
      paymentStatus: s.paymentStatus,
      grandTotal: s.grandTotal,
      itemCount: s._count.items,
      paidAt: s.paidAt,
      createdAt: s.createdAt,
    }));
  }
}
