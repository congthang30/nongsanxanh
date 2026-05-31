import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryTxType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface ReserveLine {
  variantId: string;
  quantity: number;
}

/**
 * Quan ly ton kho theo tung cua hang (StoreInventory).
 * KHONG con kho trung tam, KHONG con seller inventory.
 *
 *   available = quantityOnHand - reservedQuantity
 *
 * Workflow ton kho gan voi vong doi don:
 *   - addCart / checkout: getAvailableInStore -> chan vuot ton
 *   - createOrder (PLACED): reserveForOrder -> reservedQuantity += qty (RESERVE)
 *   - cancel / delivery failed: releaseForOrder -> reservedQuantity -= qty (RELEASE)
 *   - delivered/completed: commitForOrder -> onHand -= qty, reserved -= qty (COMMIT)
 *
 * Moi thay doi ton deu ghi InventoryTransaction.
 */
@Injectable()
export class StoreInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ton kha dung cua variant tai mot cua hang cu the. */
  async getAvailableInStore(
    storeId: string,
    variantId: string,
  ): Promise<number> {
    const inv = await this.prisma.storeInventory.findUnique({
      where: { storeId_variantId: { storeId, variantId } },
    });
    if (!inv || inv.status !== 'ACTIVE') return 0;
    return Number(inv.quantityOnHand) - Number(inv.reservedQuantity);
  }

  /** Map ton kha dung cho nhieu variant tai mot store (1 query). */
  async getAvailabilityMap(
    storeId: string,
    variantIds: string[],
  ): Promise<Map<string, number>> {
    if (variantIds.length === 0) return new Map();
    const rows = await this.prisma.storeInventory.findMany({
      where: { storeId, variantId: { in: variantIds } },
    });
    const map = new Map<string, number>();
    for (const r of rows) {
      const available =
        r.status === 'ACTIVE'
          ? Number(r.quantityOnHand) - Number(r.reservedQuantity)
          : 0;
      map.set(r.variantId, available);
    }
    for (const id of variantIds) if (!map.has(id)) map.set(id, 0);
    return map;
  }

  /** Gia ban thuc te cua variant tai store (uu tien salePrice -> priceOverride -> basePrice). */
  async getStorePrices(
    storeId: string,
    variantIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (variantIds.length === 0) return map;
    const rows = await this.prisma.storeInventory.findMany({
      where: { storeId, variantId: { in: variantIds } },
      include: { variant: { select: { price: true } } },
    });
    for (const r of rows) {
      const price = r.salePrice ?? r.priceOverride ?? r.variant.price;
      map.set(r.variantId, price);
    }
    return map;
  }

  /**
   * Giu ton (reserve) cho 1 order tai store. Tang reservedQuantity + log RESERVE.
   * Loi neu khong du ton kha dung.
   */
  async reserveForOrder(
    tx: Prisma.TransactionClient,
    storeId: string,
    orderId: string,
    lines: ReserveLine[],
    actorId?: string,
  ): Promise<void> {
    for (const line of lines) {
      const inv = await tx.storeInventory.findUnique({
        where: { storeId_variantId: { storeId, variantId: line.variantId } },
      });
      const before = inv ? Number(inv.quantityOnHand) : 0;
      const reserved = inv ? Number(inv.reservedQuantity) : 0;
      const available = inv && inv.status === 'ACTIVE' ? before - reserved : 0;
      if (!inv || available < line.quantity) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Cua hang khong du ton (variant ${line.variantId}, can ${line.quantity}, con ${available})`,
        });
      }
      await tx.storeInventory.update({
        where: { id: inv.id },
        data: { reservedQuantity: { increment: line.quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId,
          variantId: line.variantId,
          type: InventoryTxType.RESERVE,
          quantity: line.quantity,
          beforeQty: before,
          afterQty: before,
          reason: 'Reserve cho don hang',
          orderId,
          createdBy: actorId,
        },
      });
    }
  }

  /** Nha ton (release) khi huy don / giao that bai. Giam reservedQuantity + log RELEASE. */
  async releaseForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorId?: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;
    for (const it of order.items) {
      const inv = await tx.storeInventory.findUnique({
        where: {
          storeId_variantId: { storeId: order.storeId, variantId: it.variantId },
        },
      });
      if (!inv) continue;
      const qty = Number(it.quantity);
      const before = Number(inv.quantityOnHand);
      const newReserved = Math.max(0, Number(inv.reservedQuantity) - qty);
      await tx.storeInventory.update({
        where: { id: inv.id },
        data: { reservedQuantity: newReserved },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId: order.storeId,
          variantId: it.variantId,
          type: InventoryTxType.RELEASE,
          quantity: qty,
          beforeQty: before,
          afterQty: before,
          reason: 'Release ton (huy/giao that bai)',
          orderId,
          createdBy: actorId,
        },
      });
    }
  }

  /** Tru ton that su khi don giao thanh cong. Giam onHand + reserved + log COMMIT. */
  async commitForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorId?: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;
    for (const it of order.items) {
      const inv = await tx.storeInventory.findUnique({
        where: {
          storeId_variantId: { storeId: order.storeId, variantId: it.variantId },
        },
      });
      if (!inv) continue;
      const qty = Number(it.quantity);
      const before = Number(inv.quantityOnHand);
      const after = Math.max(0, before - qty);
      const newReserved = Math.max(0, Number(inv.reservedQuantity) - qty);
      await tx.storeInventory.update({
        where: { id: inv.id },
        data: { quantityOnHand: after, reservedQuantity: newReserved },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId: order.storeId,
          variantId: it.variantId,
          type: InventoryTxType.COMMIT,
          quantity: qty,
          beforeQty: before,
          afterQty: after,
          reason: 'Commit ton (don da giao)',
          orderId,
          createdBy: actorId,
        },
      });
    }
  }

  // ---------------- Warehouse staff / admin operations ----------------

  /** Nhap hang: tang onHand + log IMPORT. */
  async importStock(
    storeId: string,
    variantId: string,
    quantity: number,
    reason: string | undefined,
    actorId: string,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException({
        code: 'INVALID_QUANTITY',
        message: 'So luong nhap phai > 0',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.storeInventory.upsert({
        where: { storeId_variantId: { storeId, variantId } },
        create: { storeId, variantId, quantityOnHand: quantity },
        update: { quantityOnHand: { increment: quantity } },
      });
      const before = Number(inv.quantityOnHand) - quantity;
      await tx.inventoryTransaction.create({
        data: {
          storeId,
          variantId,
          type: InventoryTxType.IMPORT,
          quantity,
          beforeQty: before,
          afterQty: Number(inv.quantityOnHand),
          reason: reason ?? 'Nhap hang',
          createdBy: actorId,
        },
      });
      // Tu dong reactivate neu dang OUT_OF_STOCK
      if (Number(inv.quantityOnHand) > 0 && inv.status === 'OUT_OF_STOCK') {
        await tx.storeInventory.update({
          where: { id: inv.id },
          data: { status: 'ACTIVE' },
        });
      }
      return inv;
    });
  }

  /** Dieu chinh ton ve so luong moi (kiem ke). Log ADJUST. */
  async adjustStock(
    storeId: string,
    variantId: string,
    newQuantity: number,
    reason: string | undefined,
    actorId: string,
  ) {
    if (newQuantity < 0) {
      throw new BadRequestException({
        code: 'INVALID_QUANTITY',
        message: 'So luong ton khong duoc am',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.storeInventory.findUnique({
        where: { storeId_variantId: { storeId, variantId } },
      });
      const before = existing ? Number(existing.quantityOnHand) : 0;
      const reserved = existing ? Number(existing.reservedQuantity) : 0;
      if (newQuantity < reserved) {
        throw new BadRequestException({
          code: 'QTY_BELOW_RESERVED',
          message: `Khong the dieu chinh ton (${newQuantity}) thap hon so dang giu (${reserved})`,
        });
      }
      const inv = await tx.storeInventory.upsert({
        where: { storeId_variantId: { storeId, variantId } },
        create: { storeId, variantId, quantityOnHand: newQuantity },
        update: { quantityOnHand: newQuantity },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId,
          variantId,
          type: InventoryTxType.ADJUST,
          quantity: Math.abs(newQuantity - before),
          beforeQty: before,
          afterQty: newQuantity,
          reason: reason ?? 'Dieu chinh ton (kiem ke)',
          createdBy: actorId,
        },
      });
      return inv;
    });
  }

  listInventory(storeId: string, opts?: { lowStockOnly?: boolean; q?: string }) {
    return this.prisma.storeInventory
      .findMany({
        where: { storeId },
        include: {
          variant: {
            include: {
              product: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })
      .then((rows) => {
        let mapped = rows.map((r) => {
          const available =
            Number(r.quantityOnHand) - Number(r.reservedQuantity);
          return {
            id: r.id,
            variantId: r.variantId,
            sku: r.variant.sku,
            unit: r.variant.unit,
            productId: r.variant.product.id,
            productName: r.variant.product.name,
            productSlug: r.variant.product.slug,
            quantityOnHand: Number(r.quantityOnHand),
            reservedQuantity: Number(r.reservedQuantity),
            available,
            lowStockThreshold: Number(r.lowStockThreshold),
            isLowStock: available <= Number(r.lowStockThreshold),
            status: r.status,
            basePrice: r.variant.price,
            priceOverride: r.priceOverride,
            salePrice: r.salePrice,
          };
        });
        if (opts?.lowStockOnly) {
          mapped = mapped.filter((m) => m.isLowStock);
        }
        if (opts?.q) {
          const q = opts.q.toLowerCase();
          mapped = mapped.filter(
            (m) =>
              m.productName.toLowerCase().includes(q) ||
              m.sku.toLowerCase().includes(q),
          );
        }
        return mapped;
      });
  }

  listTransactions(storeId: string, variantId?: string) {
    return this.prisma.inventoryTransaction.findMany({
      where: { storeId, variantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ---------------- POS (ban tai quay) ----------------

  /**
   * Tru ton ngay khi POS thanh toan thanh cong. Phai chay trong transaction.
   * Lock tung row store_inventories (SELECT ... FOR UPDATE) de chong race khi
   * nhieu quay ban cung luc. Validate ton kha dung (tru khi allowNegative).
   * Ghi InventoryTransaction type POS_SALE cho moi item.
   */
  async commitPosSale(
    tx: Prisma.TransactionClient,
    storeId: string,
    lines: ReserveLine[],
    saleNumber: string,
    actorId: string,
    allowNegative = false,
  ): Promise<void> {
    for (const line of lines) {
      const locked = await tx.$queryRaw<
        {
          id: string;
          quantity_on_hand: string;
          reserved_quantity: string;
          status: string;
        }[]
      >(Prisma.sql`
        SELECT id, quantity_on_hand, reserved_quantity, status
        FROM store_inventories
        WHERE store_id = ${storeId} AND variant_id = ${line.variantId}
        FOR UPDATE
      `);
      const inv = locked[0];
      if (!inv || inv.status !== 'ACTIVE') {
        throw new BadRequestException({
          code: 'NO_INVENTORY',
          message: `San pham chua co ton kho tai cua hang nay (variant ${line.variantId})`,
        });
      }
      const before = Number(inv.quantity_on_hand);
      const reserved = Number(inv.reserved_quantity);
      const available = before - reserved;
      if (!allowNegative && available < line.quantity) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Cua hang khong du ton (can ${line.quantity}, con ${available})`,
        });
      }
      const after = before - line.quantity;
      await tx.storeInventory.update({
        where: { id: inv.id },
        data: {
          quantityOnHand: after,
          ...(after <= 0 ? { status: 'OUT_OF_STOCK' } : {}),
        },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId,
          variantId: line.variantId,
          type: InventoryTxType.POS_SALE,
          quantity: line.quantity,
          beforeQty: before,
          afterQty: after,
          reason: `POS sale ${saleNumber}`,
          createdBy: actorId,
        },
      });
    }
  }

  /**
   * Cong ton lai khi tra hang POS (hang con ban duoc). Ghi POS_RETURN.
   * Neu hang hong (restockable=false) thi khong cong ton, ghi POS_LOSS.
   */
  async returnPosSale(
    tx: Prisma.TransactionClient,
    storeId: string,
    lines: { variantId: string; quantity: number; restockable: boolean }[],
    saleNumber: string,
    actorId: string,
  ): Promise<void> {
    for (const line of lines) {
      const locked = await tx.$queryRaw<
        { id: string; quantity_on_hand: string; status: string }[]
      >(Prisma.sql`
        SELECT id, quantity_on_hand, status
        FROM store_inventories
        WHERE store_id = ${storeId} AND variant_id = ${line.variantId}
        FOR UPDATE
      `);
      const inv = locked[0];
      const before = inv ? Number(inv.quantity_on_hand) : 0;

      if (line.restockable && inv) {
        const after = before + line.quantity;
        await tx.storeInventory.update({
          where: { id: inv.id },
          data: {
            quantityOnHand: after,
            ...(inv.status === 'OUT_OF_STOCK' && after > 0
              ? { status: 'ACTIVE' }
              : {}),
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            storeId,
            variantId: line.variantId,
            type: InventoryTxType.POS_RETURN,
            quantity: line.quantity,
            beforeQty: before,
            afterQty: after,
            reason: `POS return ${saleNumber}`,
            createdBy: actorId,
          },
        });
      } else {
        // Hang hong hoac chua co ban ghi ton: ghi loss, khong cong ton.
        await tx.inventoryTransaction.create({
          data: {
            storeId,
            variantId: line.variantId,
            type: InventoryTxType.POS_LOSS,
            quantity: line.quantity,
            beforeQty: before,
            afterQty: before,
            reason: `POS return loss ${saleNumber}`,
            createdBy: actorId,
          },
        });
      }
    }
  }
}
