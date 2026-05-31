import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  POSPaymentMethod,
  POSPaymentRecordStatus,
  POSPaymentStatus,
  POSSaleStatus,
  Prisma,
} from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { StoreScopeService } from '../store/store-scope.service';
import { AuditService } from '../audit/audit.service';
import { CashierShiftService } from './cashier-shift.service';
import { BarcodeService } from './barcode.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PaySaleDto } from './dto/pos.dto';

const saleNo = customAlphabet('0123456789', 8);

/** Phuong thuc thanh toan dem tien mat vao cash drawer. */
const CASH_METHODS: POSPaymentMethod[] = [POSPaymentMethod.CASH];

/**
 * POSSaleService - nghiep vu ban hang tai quay (in-store).
 *
 * Khac online order:
 *   - KHONG delivery, KHONG resolve store theo dia chi, KHONG multi-store.
 *   - storeId = store cua cashier (scope), cashierId = current user.
 *   - DRAFT khong tru ton. Khi PAY: lock inventory -> validate -> tru ton ngay
 *     -> tao InventoryTransaction POS_SALE -> cong expectedCash neu tien mat.
 */
@Injectable()
export class POSSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
    private readonly scope: StoreScopeService,
    private readonly audit: AuditService,
    private readonly shifts: CashierShiftService,
    private readonly barcodes: BarcodeService,
  ) {}

  // ---------------- Helpers ----------------

  /** Store cua cashier hien tai (chong IDOR: cashier chi ban tai store minh). */
  private async cashierStoreId(user: AuthUser): Promise<string> {
    return this.scope.requireUserStoreId(user.id);
  }

  /**
   * Lay sale va dam bao thuoc store cua user (hoac admin). Nem 404/403.
   * Chong IDOR: sale.storeId phai trung store cua cashier/manager.
   */
  private async getSaleInScope(user: AuthUser, saleId: string, include?: Prisma.POSSaleInclude) {
    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: saleId },
      include: include ?? { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!sale) {
      throw new NotFoundException({
        code: 'SALE_NOT_FOUND',
        message: 'Khong tim thay hoa don',
      });
    }
    if (!this.scope.isSystemAdmin(user.roles)) {
      const storeId = await this.scope.getUserStoreId(user.id);
      if (!storeId || sale.storeId !== storeId) {
        throw new ForbiddenException({
          code: 'SALE_ACCESS_DENIED',
          message: 'Hoa don nay khong thuoc cua hang cua ban',
        });
      }
    }
    return sale;
  }

  private assertDraft(sale: { status: POSSaleStatus }) {
    if (sale.status !== POSSaleStatus.DRAFT && sale.status !== POSSaleStatus.HELD) {
      throw new BadRequestException({
        code: 'SALE_NOT_EDITABLE',
        message: 'Chi sua duoc hoa don dang tao (DRAFT/HELD)',
      });
    }
  }

  /** Tinh lai tong tien sale tu cac line item, update DB. */
  private async recalcTotals(tx: Prisma.TransactionClient, saleId: string) {
    const items = await tx.pOSSaleItem.findMany({ where: { saleId } });
    const subtotal = items.reduce((s, it) => s + it.lineTotal + it.discountAmount, 0);
    const discountTotal = items.reduce((s, it) => s + it.discountAmount, 0);
    const grandTotal = items.reduce((s, it) => s + it.lineTotal, 0);
    await tx.pOSSale.update({
      where: { id: saleId },
      data: { subtotal, discountTotal, grandTotal },
    });
  }

  private lineTotalFor(unitPrice: number, quantity: number, discount = 0): number {
    return Math.max(0, Math.round(unitPrice * quantity) - discount);
  }

  // ---------------- Sale CRUD ----------------

  /** Mo hoa don draft moi tai store cua cashier. Tu dam bao co ca mo. */
  async createSale(user: AuthUser, customerPhone?: string) {
    const storeId = await this.cashierStoreId(user);
    const sale = await this.prisma.$transaction(async (tx) => {
      const shiftId = await this.shifts.ensureOpenShift(tx, user.id, storeId);
      let customerId: string | null = null;
      if (customerPhone) {
        const customer = await tx.user.findUnique({
          where: { phone: customerPhone.trim() },
          select: { id: true },
        });
        customerId = customer?.id ?? null;
      }
      return tx.pOSSale.create({
        data: {
          saleNumber: `POS${saleNo()}`,
          storeId,
          cashierId: user.id,
          shiftId,
          customerId,
          customerPhoneSnapshot: customerPhone?.trim() || null,
          status: POSSaleStatus.DRAFT,
        },
      });
    });
    return this.getSale(user, sale.id);
  }

  /** Chi tiet hoa don (items + payments + store + cashier). */
  async getSale(user: AuthUser, saleId: string) {
    await this.getSaleInScope(user, saleId);
    return this.buildSaleView(saleId);
  }

  /** Quet barcode -> them item. Neu da co (UNIT) thi tang qty; (WEIGHT) ghi de qty. */
  async scanItem(user: AuthUser, saleId: string, barcode: string, quantity?: number) {
    const sale = await this.getSaleInScope(user, saleId);
    this.assertDraft(sale);
    const lookup = await this.barcodes.lookup(sale.storeId, barcode);

    // Canh bao het hang khi quet (khong chan o draft, chan o pay)
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.pOSSaleItem.findFirst({
        where: { saleId, variantId: lookup.variantId },
      });

      if (lookup.saleMode === 'WEIGHT') {
        const qty = quantity ?? 0;
        if (qty <= 0) {
          throw new BadRequestException({
            code: 'WEIGHT_REQUIRED',
            message: 'San pham can ky: vui long nhap khoi luong',
          });
        }
        if (existing) {
          await tx.pOSSaleItem.update({
            where: { id: existing.id },
            data: {
              quantity: qty,
              lineTotal: this.lineTotalFor(existing.unitPrice, qty, existing.discountAmount),
            },
          });
        } else {
          await this.createItem(tx, saleId, lookup, qty);
        }
      } else {
        // UNIT: tang +1 (hoac +quantity neu truyen)
        const addQty = quantity && quantity > 0 ? Math.round(quantity) : 1;
        if (existing) {
          const newQty = Number(existing.quantity) + addQty;
          await tx.pOSSaleItem.update({
            where: { id: existing.id },
            data: {
              quantity: newQty,
              lineTotal: this.lineTotalFor(existing.unitPrice, newQty, existing.discountAmount),
            },
          });
        } else {
          await this.createItem(tx, saleId, lookup, addQty);
        }
      }
      await this.recalcTotals(tx, saleId);
    });

    const view = await this.buildSaleView(saleId);
    return { sale: view, scanned: lookup };
  }

  private async createItem(
    tx: Prisma.TransactionClient,
    saleId: string,
    lookup: Awaited<ReturnType<BarcodeService['lookup']>>,
    quantity: number,
  ) {
    await tx.pOSSaleItem.create({
      data: {
        saleId,
        productId: lookup.productId,
        variantId: lookup.variantId,
        barcodeSnapshot: lookup.barcode,
        productNameSnapshot: lookup.productName,
        skuSnapshot: lookup.sku,
        unitSnapshot: lookup.unit,
        unitPrice: lookup.unitPrice,
        quantity,
        discountAmount: 0,
        lineTotal: this.lineTotalFor(lookup.unitPrice, quantity, 0),
      },
    });
  }

  /** Sua so luong mot item. */
  async updateItem(user: AuthUser, saleId: string, itemId: string, quantity: number) {
    const sale = await this.getSaleInScope(user, saleId);
    this.assertDraft(sale);
    if (quantity <= 0) {
      throw new BadRequestException({
        code: 'INVALID_QUANTITY',
        message: 'So luong phai lon hon 0',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.pOSSaleItem.findFirst({ where: { id: itemId, saleId } });
      if (!item) {
        throw new NotFoundException({
          code: 'ITEM_NOT_FOUND',
          message: 'Khong tim thay san pham trong hoa don',
        });
      }
      await tx.pOSSaleItem.update({
        where: { id: itemId },
        data: {
          quantity,
          lineTotal: this.lineTotalFor(item.unitPrice, quantity, item.discountAmount),
        },
      });
      await this.recalcTotals(tx, saleId);
    });
    return this.buildSaleView(saleId);
  }

  /** Xoa item khoi hoa don. */
  async removeItem(user: AuthUser, saleId: string, itemId: string) {
    const sale = await this.getSaleInScope(user, saleId);
    this.assertDraft(sale);
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.pOSSaleItem.findFirst({ where: { id: itemId, saleId } });
      if (!item) {
        throw new NotFoundException({
          code: 'ITEM_NOT_FOUND',
          message: 'Khong tim thay san pham trong hoa don',
        });
      }
      await tx.pOSSaleItem.delete({ where: { id: itemId } });
      await this.recalcTotals(tx, saleId);
    });
    return this.buildSaleView(saleId);
  }

  /** Treo hoa don (HELD) de phuc vu khach khac. */
  async hold(user: AuthUser, saleId: string) {
    const sale = await this.getSaleInScope(user, saleId);
    if (sale.status !== POSSaleStatus.DRAFT) {
      throw new BadRequestException({
        code: 'CANNOT_HOLD',
        message: 'Chi treo duoc hoa don dang tao',
      });
    }
    await this.prisma.pOSSale.update({
      where: { id: saleId },
      data: { status: POSSaleStatus.HELD },
    });
    return this.buildSaleView(saleId);
  }

  /** Mo lai hoa don da treo. */
  async resume(user: AuthUser, saleId: string) {
    const sale = await this.getSaleInScope(user, saleId);
    if (sale.status !== POSSaleStatus.HELD) {
      throw new BadRequestException({
        code: 'CANNOT_RESUME',
        message: 'Chi mo lai duoc hoa don dang treo',
      });
    }
    await this.prisma.pOSSale.update({
      where: { id: saleId },
      data: { status: POSSaleStatus.DRAFT },
    });
    return this.buildSaleView(saleId);
  }

  /** Danh sach hoa don cua cashier trong ca hien tai (hoac gan day). */
  async listHeldSales(user: AuthUser) {
    const storeId = await this.cashierStoreId(user);
    const sales = await this.prisma.pOSSale.findMany({
      where: { storeId, cashierId: user.id, status: POSSaleStatus.HELD },
      orderBy: { updatedAt: 'desc' },
      include: { items: true },
    });
    return sales.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      grandTotal: s.grandTotal,
      itemCount: s.items.length,
      customerPhone: s.customerPhoneSnapshot,
      updatedAt: s.updatedAt,
    }));
  }

  // ---------------- Payment ----------------

  /**
   * Thanh toan hoa don. Atomic transaction:
   *   1. lock inventory rows + validate ton (commitPosSale)
   *   2. tao POSPayment records
   *   3. update sale PAID + amountPaid/changeAmount
   *   4. cong expectedCash cho shift neu co payment tien mat
   * CASH: tien khach dua (tendered) >= grandTotal, tinh tien thoi.
   */
  async pay(user: AuthUser, saleId: string, dto: PaySaleDto) {
    const sale = await this.getSaleInScope(user, saleId, {
      items: true,
    });
    if (sale.status !== POSSaleStatus.DRAFT && sale.status !== POSSaleStatus.HELD) {
      throw new BadRequestException({
        code: 'SALE_NOT_PAYABLE',
        message: 'Hoa don nay khong the thanh toan',
      });
    }
    if (sale.items.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_SALE',
        message: 'Hoa don chua co san pham',
      });
    }

    const grandTotal = sale.items.reduce((s, it) => s + it.lineTotal, 0);
    const totalPaid = dto.payments.reduce((s, p) => s + p.amount, 0);

    // Validate tung payment + tinh tien thoi tu tien mat
    let cashTendered = 0;
    let cashAmount = 0;
    for (const p of dto.payments) {
      if (p.amount <= 0) {
        throw new BadRequestException({
          code: 'INVALID_PAYMENT_AMOUNT',
          message: 'So tien thanh toan phai lon hon 0',
        });
      }
      if (CASH_METHODS.includes(p.method)) {
        cashAmount += p.amount;
        const tendered = p.tendered ?? p.amount;
        if (tendered < p.amount) {
          throw new BadRequestException({
            code: 'CASH_TENDERED_TOO_LOW',
            message: 'Tien khach dua khong duoc nho hon so tien can thanh toan',
          });
        }
        cashTendered += tendered;
      }
    }

    // MVP khong split payment: tong thanh toan phai >= grandTotal
    if (totalPaid < grandTotal) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_PAYMENT',
        message: `Tong thanh toan (${totalPaid}) nho hon tong tien (${grandTotal})`,
      });
    }

    // Tien thoi chi tinh tren phan tien mat vuot grand total
    const changeAmount = cashAmount > 0 ? Math.max(0, cashTendered - grandTotal) : 0;

    const allowNegative =
      dto.allowNegativeStock === true &&
      (this.scope.isSystemAdmin(user.roles) ||
        user.permissions?.includes('ALLOW_NEGATIVE_STOCK') ||
        user.roles.includes('STORE_MANAGER'));

    const lines = sale.items.map((it) => ({
      variantId: it.variantId,
      quantity: Number(it.quantity),
    }));

    await this.prisma.$transaction(async (tx) => {
      // 1. Tru ton (lock rows + validate) + InventoryTransaction POS_SALE
      await this.inventory.commitPosSale(
        tx,
        sale.storeId,
        lines,
        sale.saleNumber,
        user.id,
        allowNegative,
      );

      // 2. Payment records
      for (const p of dto.payments) {
        const isCash = CASH_METHODS.includes(p.method);
        await tx.pOSPayment.create({
          data: {
            saleId,
            method: p.method,
            amount: p.amount,
            status: POSPaymentRecordStatus.SUCCESS,
            reference: p.reference,
            tendered: isCash ? p.tendered ?? p.amount : null,
            change: isCash ? Math.max(0, (p.tendered ?? p.amount) - p.amount) : null,
            paidAt: new Date(),
          },
        });
      }

      // 3. Update sale PAID
      await tx.pOSSale.update({
        where: { id: saleId },
        data: {
          status: POSSaleStatus.PAID,
          paymentStatus: POSPaymentStatus.PAID,
          subtotal: sale.items.reduce((s, it) => s + it.lineTotal + it.discountAmount, 0),
          discountTotal: sale.items.reduce((s, it) => s + it.discountAmount, 0),
          grandTotal,
          amountPaid: totalPaid,
          changeAmount,
          paidAt: new Date(),
        },
      });

      // 4. Cong expectedCash cho shift neu co tien mat
      if (cashAmount > 0 && sale.shiftId) {
        await tx.cashierShift.update({
          where: { id: sale.shiftId },
          data: { expectedCash: { increment: cashAmount } },
        });
      }

      // Audit log thanh toan
      await this.audit.log(
        {
          action: 'POS_SALE_PAID',
          actorId: user.id,
          targetType: 'POSSale',
          targetId: saleId,
          storeId: sale.storeId,
          metadata: {
            saleNumber: sale.saleNumber,
            grandTotal,
            methods: dto.payments.map((p) => p.method),
            cashAmount,
            changeAmount,
            allowNegative,
          },
        },
        tx,
      );
    });

    return this.buildSaleView(saleId);
  }

  // ---------------- Void ----------------

  /**
   * Huy hoa don. DRAFT/HELD: cashier tu huy. PAID: chi admin (qua controller
   * guard) hoac manager-void (POSReturnService). Khong cong ton vi DRAFT chua tru.
   */
  async voidSale(user: AuthUser, saleId: string, reason: string, isManagerOverride = false) {
    const sale = await this.getSaleInScope(user, saleId, { items: true });

    if (sale.status === POSSaleStatus.VOIDED) {
      throw new BadRequestException({
        code: 'ALREADY_VOIDED',
        message: 'Hoa don da bi huy',
      });
    }

    const isPaid = sale.status === POSSaleStatus.PAID;
    if (isPaid && !isManagerOverride && !this.scope.isSystemAdmin(user.roles)) {
      throw new ForbiddenException({
        code: 'VOID_NEEDS_APPROVAL',
        message: 'Huy hoa don da thanh toan can quyen quan ly/admin',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Neu sale da PAID -> hoan ton lai (hang con ban duoc) + refund payment
      if (isPaid) {
        const restockLines = sale.items.map((it) => ({
          variantId: it.variantId,
          quantity: Number(it.quantity),
          restockable: true,
        }));
        await this.inventory.returnPosSale(
          tx,
          sale.storeId,
          restockLines,
          sale.saleNumber,
          user.id,
        );
        await tx.pOSPayment.updateMany({
          where: { saleId },
          data: { status: POSPaymentRecordStatus.REFUNDED },
        });
        // Tru lai expectedCash neu tien mat
        const cashPaid = await tx.pOSPayment.aggregate({
          where: { saleId, method: POSPaymentMethod.CASH },
          _sum: { amount: true },
        });
        if (sale.shiftId && cashPaid._sum.amount) {
          await tx.cashierShift.update({
            where: { id: sale.shiftId },
            data: { expectedCash: { decrement: cashPaid._sum.amount } },
          });
        }
      }

      await tx.pOSSale.update({
        where: { id: saleId },
        data: {
          status: POSSaleStatus.VOIDED,
          paymentStatus: isPaid ? POSPaymentStatus.REFUNDED : POSPaymentStatus.FAILED,
          voidedAt: new Date(),
          voidReason: reason,
          voidedBy: user.id,
        },
      });

      await this.audit.log(
        {
          action: isManagerOverride ? 'POS_SALE_MANAGER_VOID' : 'POS_SALE_VOID',
          actorId: user.id,
          targetType: 'POSSale',
          targetId: saleId,
          storeId: sale.storeId,
          metadata: { saleNumber: sale.saleNumber, reason, wasPaid: isPaid },
        },
        tx,
      );
    });

    return this.buildSaleView(saleId);
  }

  // ---------------- Receipt ----------------

  /** Du lieu in hoa don: thong tin store, items, payment, tien thoi. */
  async getReceipt(user: AuthUser, saleId: string) {
    await this.getSaleInScope(user, saleId);
    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: saleId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        payments: true,
        store: true,
        cashier: { include: { profile: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException({ code: 'SALE_NOT_FOUND', message: 'Khong tim thay hoa don' });
    }
    return {
      saleNumber: sale.saleNumber,
      status: sale.status,
      createdAt: sale.createdAt,
      paidAt: sale.paidAt,
      store: {
        name: sale.store.name,
        code: sale.store.code,
        address: sale.store.formattedAddress ?? sale.store.addressLine,
        phone: sale.store.phone,
      },
      cashier: {
        name: sale.cashier.profile?.fullName ?? sale.cashier.email,
      },
      customerPhone: sale.customerPhoneSnapshot,
      items: sale.items.map((it) => ({
        name: it.productNameSnapshot,
        sku: it.skuSnapshot,
        unit: it.unitSnapshot,
        barcode: it.barcodeSnapshot,
        unitPrice: it.unitPrice,
        quantity: Number(it.quantity),
        discountAmount: it.discountAmount,
        lineTotal: it.lineTotal,
      })),
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      taxTotal: sale.taxTotal,
      grandTotal: sale.grandTotal,
      amountPaid: sale.amountPaid,
      changeAmount: sale.changeAmount,
      payments: sale.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        tendered: p.tendered,
        change: p.change,
        reference: p.reference,
        status: p.status,
      })),
      hotline: '1800 1234',
    };
  }

  // ---------------- View builder ----------------

  private async buildSaleView(saleId: string) {
    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: saleId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        payments: true,
        store: { select: { id: true, name: true, code: true } },
        cashier: { include: { profile: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException({ code: 'SALE_NOT_FOUND', message: 'Khong tim thay hoa don' });
    }
    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      storeId: sale.storeId,
      storeName: sale.store.name,
      cashierId: sale.cashierId,
      cashierName: sale.cashier.profile?.fullName ?? sale.cashier.email,
      shiftId: sale.shiftId,
      customerPhone: sale.customerPhoneSnapshot,
      items: sale.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        variantId: it.variantId,
        name: it.productNameSnapshot,
        sku: it.skuSnapshot,
        unit: it.unitSnapshot,
        barcode: it.barcodeSnapshot,
        unitPrice: it.unitPrice,
        quantity: Number(it.quantity),
        discountAmount: it.discountAmount,
        lineTotal: it.lineTotal,
      })),
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      taxTotal: sale.taxTotal,
      grandTotal: sale.grandTotal,
      amountPaid: sale.amountPaid,
      changeAmount: sale.changeAmount,
      paidAt: sale.paidAt,
      voidedAt: sale.voidedAt,
      voidReason: sale.voidReason,
      payments: sale.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        tendered: p.tendered,
        change: p.change,
        reference: p.reference,
        status: p.status,
      })),
    };
  }
}
