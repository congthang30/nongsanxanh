import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BatchAllocationStatus,
  InventoryBatchStatus,
  InventoryTxType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';

export interface ReserveLine {
  variantId: string;
  batchId?: string | null;
  quantity: number;
  orderItemId?: string;
  saleItemId?: string;
}

export interface ImportBatchInput {
  batchCode: string;
  receivedDate: string;
  expiryDate: string;
}

/**
 * Ton kho vat ly duoc quan ly theo lo. StoreInventory chi la bang tong hop de
 * catalog doc nhanh; moi thay doi phai cap nhat lo va bang tong hop trong cung
 * transaction.
 *
 * FEFO: dat online va POS luon lay lo co han dung som nhat truoc. Lo het han,
 * BLOCKED hoac DEPLETED khong duoc tinh vao ton co the ban.
 */
@Injectable()
export class StoreInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
  ) {}

  private dateOnly(value: string, field: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException({
        code: 'INVALID_BATCH_DATE',
        message: `${field} phai co dinh dang YYYY-MM-DD`,
      });
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException({
        code: 'INVALID_BATCH_DATE',
        message: `${field} khong hop le`,
      });
    }
    return date;
  }

  private today() {
    // Vietnam has a fixed UTC+7 offset and no daylight-saving transitions.
    const vietnamNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return new Date(`${vietnamNow.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  private restockedBatchStatus(expiryDate: Date, status: InventoryBatchStatus) {
    if (status === InventoryBatchStatus.BLOCKED) return status;
    return expiryDate >= this.today()
      ? InventoryBatchStatus.ACTIVE
      : InventoryBatchStatus.BLOCKED;
  }

  private async sellableBatches(
    client: Prisma.TransactionClient | PrismaService,
    storeId: string,
    variantId: string,
  ) {
    return client.inventoryBatch.findMany({
      where: {
        storeId,
        variantId,
        status: InventoryBatchStatus.ACTIVE,
        expiryDate: { gte: this.today() },
        quantityOnHand: { gt: 0 },
      },
      orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getAvailableInStore(storeId: string, variantId: string): Promise<number> {
    const batches = await this.sellableBatches(this.prisma, storeId, variantId);
    return batches.reduce(
      (sum, batch) =>
        sum + Math.max(0, Number(batch.quantityOnHand) - Number(batch.reservedQuantity)),
      0,
    );
  }

  async getAvailabilityMap(storeId: string, variantIds: string[]) {
    const map = new Map<string, number>();
    for (const id of variantIds) map.set(id, 0);
    if (variantIds.length === 0) return map;
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        storeId,
        variantId: { in: variantIds },
        status: InventoryBatchStatus.ACTIVE,
        expiryDate: { gte: this.today() },
        quantityOnHand: { gt: 0 },
      },
      select: { variantId: true, quantityOnHand: true, reservedQuantity: true },
    });
    for (const batch of batches) {
      const available = Math.max(
        0,
        Number(batch.quantityOnHand) - Number(batch.reservedQuantity),
      );
      map.set(batch.variantId, (map.get(batch.variantId) ?? 0) + available);
    }
    return map;
  }

  async getAggregateAvailable(variantId: string): Promise<number> {
    const map = await this.getAggregateAvailabilityMap([variantId]);
    return map.get(variantId) ?? 0;
  }

  async getAggregateAvailabilityMap(variantIds: string[]) {
    const map = new Map<string, number>();
    for (const id of variantIds) map.set(id, 0);
    if (variantIds.length === 0) return map;
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        variantId: { in: variantIds },
        status: InventoryBatchStatus.ACTIVE,
        expiryDate: { gte: this.today() },
        quantityOnHand: { gt: 0 },
        store: { status: 'ACTIVE' },
      },
      select: { variantId: true, quantityOnHand: true, reservedQuantity: true },
    });
    for (const batch of batches) {
      const available = Math.max(
        0,
        Number(batch.quantityOnHand) - Number(batch.reservedQuantity),
      );
      map.set(batch.variantId, (map.get(batch.variantId) ?? 0) + available);
    }
    return map;
  }

  async getStoreCoverageMap(variantIds: string[]) {
    const map = new Map<string, number>();
    for (const id of variantIds) map.set(id, 0);
    if (variantIds.length === 0) return map;
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        variantId: { in: variantIds },
        status: InventoryBatchStatus.ACTIVE,
        expiryDate: { gte: this.today() },
        quantityOnHand: { gt: 0 },
        store: { status: 'ACTIVE' },
      },
      select: {
        storeId: true,
        variantId: true,
        quantityOnHand: true,
        reservedQuantity: true,
      },
    });
    const covered = new Set<string>();
    for (const batch of batches) {
      if (Number(batch.quantityOnHand) > Number(batch.reservedQuantity)) {
        covered.add(`${batch.variantId}:${batch.storeId}`);
      }
    }
    for (const key of covered) {
      const variantId = key.split(':')[0];
      map.set(variantId, (map.get(variantId) ?? 0) + 1);
    }
    return map;
  }

  getScheduledSalePrices(
    variantIds: string[],
    tx?: Prisma.TransactionClient,
  ) {
    return this.campaigns.getActiveSalePrices(variantIds, tx);
  }

  async getBatchOptions(
    storeId: string,
    variantIds: string[],
    tx?: Prisma.TransactionClient,
  ) {
    if (variantIds.length === 0) return [];
    const client = tx ?? this.prisma;
    const [batches, storeRows, scheduledPrices] = await Promise.all([
      client.inventoryBatch.findMany({
        where: {
          storeId,
          variantId: { in: variantIds },
          status: InventoryBatchStatus.ACTIVE,
          expiryDate: { gte: this.today() },
          quantityOnHand: { gt: 0 },
        },
        include: { variant: { select: { price: true } } },
        orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }, { createdAt: 'asc' }],
      }),
      client.storeInventory.findMany({
        where: { storeId, variantId: { in: variantIds } },
        select: { variantId: true, salePrice: true, priceOverride: true },
      }),
      this.campaigns.getActiveSalePrices(variantIds, tx, true),
    ]);
    const storePrices = new Map(
      storeRows.map((row) => [row.variantId, row.salePrice ?? row.priceOverride]),
    );
    return batches.flatMap((batch) => {
      const available = Math.max(
        0,
        Number(batch.quantityOnHand) - Number(batch.reservedQuantity),
      );
      if (available <= 0) return [];
      const basePrice =
        storePrices.get(batch.variantId) ?? batch.variant.price;
      const unitPrice =
        scheduledPrices.get(`${batch.variantId}:${batch.id}`) ??
        scheduledPrices.get(batch.variantId) ??
        basePrice;
      return [{
        id: batch.id,
        variantId: batch.variantId,
        batchCode: batch.batchCode,
        expiryDate: batch.expiryDate,
        available,
        unitPrice,
        originalPrice: batch.variant.price,
        onSale: unitPrice < batch.variant.price,
      }];
    });
  }

  async getBatchPrices(
    storeId: string,
    lines: { variantId: string; batchId?: string | null }[],
    tx?: Prisma.TransactionClient,
  ) {
    const options = await this.getBatchOptions(
      storeId,
      [...new Set(lines.map((line) => line.variantId))],
      tx,
    );
    const batchMap = new Map(options.map((option) => [option.id, option]));
    const defaultMap = new Map<string, (typeof options)[number]>();
    for (const option of options) {
      if (!defaultMap.has(option.variantId)) defaultMap.set(option.variantId, option);
    }
    return lines.map((line) => {
      const option = line.batchId ? batchMap.get(line.batchId) : defaultMap.get(line.variantId);
      if (!option || option.variantId !== line.variantId) {
        throw new BadRequestException({
          code: 'BATCH_NOT_SELLABLE',
          message: 'Lô đã chọn không còn bán tại cửa hàng này',
        });
      }
      return option;
    });
  }

  async getPricedBatchAllocations(
    storeId: string,
    lines: { variantId: string; batchId?: string | null; quantity: number }[],
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) {
      const lockKeys = [...new Map(
        lines.map((line) => [
          `${line.variantId}:${line.batchId ?? ''}`,
          { variantId: line.variantId, batchId: line.batchId },
        ]),
      ).values()].sort((a, b) =>
        a.variantId.localeCompare(b.variantId) ||
        (a.batchId ?? '').localeCompare(b.batchId ?? ''),
      );
      for (const key of lockKeys) {
        await this.lockSellableBatches(tx, storeId, key.variantId, key.batchId);
      }
    }
    const options = await this.getBatchOptions(
      storeId,
      [...new Set(lines.map((line) => line.variantId))],
      tx,
    );
    return lines.map((line) => {
      const candidates = options.filter(
        (option) =>
          option.variantId === line.variantId &&
          (!line.batchId || option.id === line.batchId),
      );
      let remaining = line.quantity;
      const allocations = candidates.flatMap((option) => {
        if (remaining <= 0) return [];
        const quantity = Math.min(remaining, option.available);
        remaining -= quantity;
        return quantity > 0
          ? [{
              batchId: option.id,
              batchCode: option.batchCode,
              expiryDate: option.expiryDate,
              quantity,
              unitPrice: option.unitPrice,
              lineTotal: Math.round(option.unitPrice * quantity),
            }]
          : [];
      });
      return {
        available: candidates.reduce((sum, option) => sum + option.available, 0),
        fulfilled: remaining <= 0,
        allocations,
      };
    });
  }

  async getStorePrices(
    storeId: string,
    variantIds: string[],
    tx?: Prisma.TransactionClient,
  ) {
    const map = new Map<string, number>();
    const options = await this.getBatchOptions(storeId, variantIds, tx);
    for (const option of options) {
      if (!map.has(option.variantId)) map.set(option.variantId, option.unitPrice);
    }
    return map;
  }

  private async lockSellableBatches(
    tx: Prisma.TransactionClient,
    storeId: string,
    variantId: string,
    batchId?: string | null,
  ) {
    const today = this.today();
    return tx.$queryRaw<
      {
        id: string;
        quantity_on_hand: string;
        reserved_quantity: string;
        expiry_date: Date;
      }[]
    >(Prisma.sql`
      SELECT id, quantity_on_hand, reserved_quantity, expiry_date
      FROM inventory_batches
      WHERE store_id = ${storeId}
        AND variant_id = ${variantId}
        ${batchId ? Prisma.sql`AND id = ${batchId}` : Prisma.empty}
        AND status = 'ACTIVE'::"InventoryBatchStatus"
        AND expiry_date >= ${today}::date
        AND quantity_on_hand > reserved_quantity
      ORDER BY expiry_date ASC, received_date ASC, created_at ASC
      FOR UPDATE
    `);
  }

  private async findOrderItemId(
    tx: Prisma.TransactionClient,
    orderId: string,
    line: ReserveLine,
  ) {
    if (line.orderItemId) return line.orderItemId;
    const item = await tx.orderItem.findFirst({
      where: { orderId, variantId: line.variantId },
      select: { id: true },
    });
    if (!item) {
      throw new BadRequestException({
        code: 'ORDER_ITEM_NOT_FOUND',
        message: 'Khong tim thay dong san pham de giu lo',
      });
    }
    return item.id;
  }

  async reserveForOrder(
    tx: Prisma.TransactionClient,
    storeId: string,
    orderId: string,
    lines: ReserveLine[],
    actorId?: string,
  ) {
    for (const line of lines) {
      const orderItemId = await this.findOrderItemId(tx, orderId, line);
      const batches = await this.lockSellableBatches(
        tx,
        storeId,
        line.variantId,
        line.batchId,
      );
      const totalAvailable = batches.reduce(
        (sum, batch) =>
          sum + Number(batch.quantity_on_hand) - Number(batch.reserved_quantity),
        0,
      );
      if (totalAvailable < line.quantity) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Khong du ton lo con han (can ${line.quantity}, con ${totalAvailable})`,
        });
      }

      let remaining = line.quantity;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const available =
          Number(batch.quantity_on_hand) - Number(batch.reserved_quantity);
        const allocated = Math.min(remaining, available);
        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: { reservedQuantity: { increment: allocated } },
        });
        await tx.orderItemBatchAllocation.create({
          data: {
            orderItemId,
            batchId: batch.id,
            quantity: allocated,
            status: BatchAllocationStatus.RESERVED,
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            storeId,
            variantId: line.variantId,
            batchId: batch.id,
            type: InventoryTxType.RESERVE,
            quantity: allocated,
            beforeQty: Number(batch.quantity_on_hand),
            afterQty: Number(batch.quantity_on_hand),
            reason: 'Reserve FEFO cho don hang',
            orderId,
            createdBy: actorId,
          },
        });
        remaining -= allocated;
      }
      await tx.storeInventory.update({
        where: { storeId_variantId: { storeId, variantId: line.variantId } },
        data: { reservedQuantity: { increment: line.quantity } },
      });
    }
  }

  async releaseForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorId?: string,
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    const allocations = await tx.orderItemBatchAllocation.findMany({
      where: {
        orderItem: { orderId },
        status: BatchAllocationStatus.RESERVED,
      },
      include: { orderItem: { select: { variantId: true } } },
    });
    const totals = new Map<string, number>();
    for (const allocation of allocations) {
      const batch = await tx.inventoryBatch.findUnique({ where: { id: allocation.batchId } });
      if (!batch) continue;
      const quantity = Number(allocation.quantity);
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: { reservedQuantity: { decrement: quantity } },
      });
      await tx.orderItemBatchAllocation.update({
        where: { id: allocation.id },
        data: { status: BatchAllocationStatus.RELEASED },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId: order.storeId,
          variantId: allocation.orderItem.variantId,
          batchId: batch.id,
          type: InventoryTxType.RELEASE,
          quantity,
          beforeQty: batch.quantityOnHand,
          afterQty: batch.quantityOnHand,
          reason: 'Release lo (huy/giao that bai)',
          orderId,
          createdBy: actorId,
        },
      });
      totals.set(
        allocation.orderItem.variantId,
        (totals.get(allocation.orderItem.variantId) ?? 0) + quantity,
      );
    }
    for (const [variantId, quantity] of totals) {
      await tx.storeInventory.update({
        where: { storeId_variantId: { storeId: order.storeId, variantId } },
        data: { reservedQuantity: { decrement: quantity } },
      });
    }
  }

  async assertOrderBatchesSellable(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const allocations = await tx.orderItemBatchAllocation.findMany({
      where: {
        orderItem: { orderId },
        status: BatchAllocationStatus.RESERVED,
      },
      include: { batch: true },
    });
    const today = this.today();
    const invalid = allocations.find(
      ({ batch }) =>
        batch.status !== InventoryBatchStatus.ACTIVE ||
        batch.expiryDate < today,
    );
    if (invalid) {
      throw new BadRequestException({
        code: 'ORDER_BATCH_NOT_SELLABLE',
        message: `Lo ${invalid.batch.batchCode} da het han hoac bi khoa. Vui long thay lo truoc khi dong goi.`,
      });
    }
  }

  async commitForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorId?: string,
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    const allocations = await tx.orderItemBatchAllocation.findMany({
      where: {
        orderItem: { orderId },
        status: BatchAllocationStatus.RESERVED,
      },
      include: { orderItem: { select: { variantId: true } } },
    });
    const totals = new Map<string, number>();
    const today = this.today();
    for (const allocation of allocations) {
      const batch = await tx.inventoryBatch.findUnique({ where: { id: allocation.batchId } });
      if (!batch) continue;
      if (
        batch.status !== InventoryBatchStatus.ACTIVE ||
        batch.expiryDate < today
      ) {
        throw new BadRequestException({
          code: 'ORDER_BATCH_NOT_SELLABLE',
          message: `Lo ${batch.batchCode} da het han hoac bi khoa. Khong the giao don nay.`,
        });
      }
      const quantity = Number(allocation.quantity);
      const before = Number(batch.quantityOnHand);
      const after = before - quantity;
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          quantityOnHand: after,
          reservedQuantity: { decrement: quantity },
          status: after === 0 ? InventoryBatchStatus.DEPLETED : batch.status,
        },
      });
      await tx.orderItemBatchAllocation.update({
        where: { id: allocation.id },
        data: { status: BatchAllocationStatus.COMMITTED },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId: order.storeId,
          variantId: allocation.orderItem.variantId,
          batchId: batch.id,
          type: InventoryTxType.COMMIT,
          quantity,
          beforeQty: before,
          afterQty: after,
          reason: 'Commit FEFO (don da giao)',
          orderId,
          createdBy: actorId,
        },
      });
      totals.set(
        allocation.orderItem.variantId,
        (totals.get(allocation.orderItem.variantId) ?? 0) + quantity,
      );
    }
    for (const [variantId, quantity] of totals) {
      const inventory = await tx.storeInventory.update({
        where: { storeId_variantId: { storeId: order.storeId, variantId } },
        data: {
          quantityOnHand: { decrement: quantity },
          reservedQuantity: { decrement: quantity },
        },
      });
      if (Number(inventory.quantityOnHand) === 0) {
        await tx.storeInventory.update({
          where: { id: inventory.id },
          data: { status: 'OUT_OF_STOCK' },
        });
      }
    }
  }

  async importStock(
    storeId: string,
    variantId: string,
    quantity: number,
    batchInput: ImportBatchInput,
    reason: string | undefined,
    actorId: string,
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException({ code: 'INVALID_QUANTITY', message: 'So luong nhap phai > 0' });
    }
    const batchCode = batchInput.batchCode.trim().toUpperCase();
    if (!batchCode || batchCode.length > 80) {
      throw new BadRequestException({ code: 'INVALID_BATCH_CODE', message: 'Ma lo bat buoc, toi da 80 ky tu' });
    }
    const receivedDate = this.dateOnly(batchInput.receivedDate, 'Ngay nhap');
    const expiryDate = this.dateOnly(batchInput.expiryDate, 'Han dung');
    if (expiryDate < receivedDate) {
      throw new BadRequestException({ code: 'INVALID_BATCH_DATES', message: 'Han dung phai tu ngay nhap tro di' });
    }
    if (expiryDate < this.today()) {
      throw new BadRequestException({ code: 'BATCH_ALREADY_EXPIRED', message: 'Khong the nhap lo da het han' });
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryBatch.findUnique({
        where: { storeId_variantId_batchCode: { storeId, variantId, batchCode } },
      });
      if (
        existing &&
        (existing.receivedDate.toISOString().slice(0, 10) !== batchInput.receivedDate ||
          existing.expiryDate.toISOString().slice(0, 10) !== batchInput.expiryDate)
      ) {
        throw new BadRequestException({
          code: 'BATCH_DATES_MISMATCH',
          message: 'Ma lo da ton tai nhung ngay nhap/han dung khong khop',
        });
      }
      const before = existing ? Number(existing.quantityOnHand) : 0;
      const batch = existing
        ? await tx.inventoryBatch.update({
            where: { id: existing.id },
            data: {
              quantityOnHand: { increment: quantity },
              status: InventoryBatchStatus.ACTIVE,
            },
          })
        : await tx.inventoryBatch.create({
            data: {
              storeId,
              variantId,
              batchCode,
              receivedDate,
              expiryDate,
              quantityOnHand: quantity,
            },
          });
      const inventory = await tx.storeInventory.upsert({
        where: { storeId_variantId: { storeId, variantId } },
        create: { storeId, variantId, quantityOnHand: quantity },
        update: { quantityOnHand: { increment: quantity }, status: 'ACTIVE' },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId,
          variantId,
          batchId: batch.id,
          type: InventoryTxType.IMPORT,
          quantity,
          beforeQty: before,
          afterQty: Number(batch.quantityOnHand),
          reason: reason ?? 'Nhap hang theo lo',
          createdBy: actorId,
        },
      });
      return { ...inventory, batch };
    });
  }

  async adjustStock(
    storeId: string,
    variantId: string,
    batchId: string,
    newQuantity: number,
    reason: string | undefined,
    actorId: string,
  ) {
    if (!Number.isFinite(newQuantity) || newQuantity < 0) {
      throw new BadRequestException({ code: 'INVALID_QUANTITY', message: 'So luong ton khong duoc am' });
    }
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryBatch.findFirst({ where: { id: batchId, storeId, variantId } });
      if (!batch) throw new NotFoundException({ code: 'BATCH_NOT_FOUND', message: 'Khong tim thay lo trong kho' });
      const reserved = Number(batch.reservedQuantity);
      if (newQuantity < reserved) {
        throw new BadRequestException({
          code: 'QTY_BELOW_RESERVED',
          message: `Khong the dieu chinh lo thap hon so dang giu (${reserved})`,
        });
      }
      const before = Number(batch.quantityOnHand);
      const delta = newQuantity - before;
      const updatedBatch = await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          quantityOnHand: newQuantity,
          status:
            newQuantity === 0
              ? InventoryBatchStatus.DEPLETED
              : batch.status === InventoryBatchStatus.DEPLETED
                ? InventoryBatchStatus.ACTIVE
                : batch.status,
        },
      });
      const projection = await tx.storeInventory.findUniqueOrThrow({
        where: { storeId_variantId: { storeId, variantId } },
      });
      const aggregateAfter = Number(projection.quantityOnHand) + delta;
      const inventory = await tx.storeInventory.update({
        where: { id: projection.id },
        data: {
          quantityOnHand: aggregateAfter,
          status: aggregateAfter === 0 ? 'OUT_OF_STOCK' : 'ACTIVE',
        },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId,
          variantId,
          batchId,
          type: InventoryTxType.ADJUST,
          quantity: Math.abs(delta),
          beforeQty: before,
          afterQty: newQuantity,
          reason: reason ?? 'Kiem ke theo lo',
          createdBy: actorId,
        },
      });
      return { ...inventory, batch: updatedBatch };
    });
  }

  async listInventory(storeId: string, opts?: { lowStockOnly?: boolean; q?: string }) {
    const rows = await this.prisma.storeInventory.findMany({
      where: { storeId },
      include: {
        variant: { include: { product: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { storeId },
      orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
    });
    const byVariant = new Map<string, typeof batches>();
    for (const batch of batches) {
      const list = byVariant.get(batch.variantId) ?? [];
      list.push(batch);
      byVariant.set(batch.variantId, list);
    }
    const today = this.today();
    let mapped = rows.map((row) => {
      const variantBatches = byVariant.get(row.variantId) ?? [];
      const quantityOnHand = variantBatches.reduce((sum, batch) => sum + Number(batch.quantityOnHand), 0);
      const reservedQuantity = variantBatches.reduce((sum, batch) => sum + Number(batch.reservedQuantity), 0);
      const available = variantBatches.reduce(
        (sum, batch) =>
          sum +
          (batch.status === InventoryBatchStatus.ACTIVE && batch.expiryDate >= today
            ? Math.max(0, Number(batch.quantityOnHand) - Number(batch.reservedQuantity))
            : 0),
        0,
      );
      return {
        id: row.id,
        variantId: row.variantId,
        sku: row.variant.sku,
        unit: row.variant.unit,
        productId: row.variant.product.id,
        productName: row.variant.product.name,
        productSlug: row.variant.product.slug,
        quantityOnHand,
        reservedQuantity,
        available,
        expiredQuantity: variantBatches.reduce(
          (sum, batch) => sum + (batch.expiryDate < today ? Number(batch.quantityOnHand) : 0),
          0,
        ),
        lowStockThreshold: Number(row.lowStockThreshold),
        isLowStock: available <= Number(row.lowStockThreshold),
        status: quantityOnHand > 0 ? row.status : 'OUT_OF_STOCK',
        basePrice: row.variant.price,
        priceOverride: row.priceOverride,
        salePrice: row.salePrice,
        batches: variantBatches.map((batch) => ({
          id: batch.id,
          batchCode: batch.batchCode,
          receivedDate: batch.receivedDate,
          expiryDate: batch.expiryDate,
          quantityOnHand: Number(batch.quantityOnHand),
          reservedQuantity: Number(batch.reservedQuantity),
          available:
            batch.status === InventoryBatchStatus.ACTIVE && batch.expiryDate >= today
              ? Math.max(0, Number(batch.quantityOnHand) - Number(batch.reservedQuantity))
              : 0,
          status: batch.status,
          isExpired: batch.expiryDate < today,
        })),
      };
    });
    if (opts?.lowStockOnly) mapped = mapped.filter((row) => row.isLowStock);
    if (opts?.q) {
      const query = opts.q.toLowerCase();
      mapped = mapped.filter(
        (row) => row.productName.toLowerCase().includes(query) || row.sku.toLowerCase().includes(query),
      );
    }
    return mapped;
  }

  listTransactions(
    storeId: string,
    filter?: { variantId?: string; type?: InventoryTxType; from?: string; to?: string },
  ) {
    const where: Prisma.InventoryTransactionWhereInput = { storeId };
    if (filter?.variantId) where.variantId = filter.variantId;
    if (filter?.type) where.type = filter.type;
    if (filter?.from || filter?.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = new Date(filter.from);
      if (filter.to) where.createdAt.lte = new Date(filter.to);
    }
    return this.prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        store: { select: { name: true, code: true } },
        batch: { select: { batchCode: true, receivedDate: true, expiryDate: true } },
      },
    });
  }

  async exportStock(
    storeId: string,
    variantId: string,
    batchId: string,
    quantity: number,
    reason: string,
    kind: 'EXPORT' | 'LOSS',
    actorId: string,
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException({ code: 'INVALID_QUANTITY', message: 'So luong xuat phai > 0' });
    }
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Vui long ghi ly do xuat/hu' });
    }
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryBatch.findFirst({ where: { id: batchId, storeId, variantId } });
      if (!batch) throw new NotFoundException({ code: 'BATCH_NOT_FOUND', message: 'Khong tim thay lo trong kho' });
      const before = Number(batch.quantityOnHand);
      const available = before - Number(batch.reservedQuantity);
      if (quantity > available) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_AVAILABLE',
          message: `Lo ${batch.batchCode} chi con ${available} kha dung`,
        });
      }
      const after = before - quantity;
      const updatedBatch = await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          quantityOnHand: after,
          status: after === 0 ? InventoryBatchStatus.DEPLETED : batch.status,
        },
      });
      const inventory = await tx.storeInventory.update({
        where: { storeId_variantId: { storeId, variantId } },
        data: { quantityOnHand: { decrement: quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          storeId,
          variantId,
          batchId,
          type: kind === 'LOSS' ? InventoryTxType.POS_LOSS : InventoryTxType.EXPORT,
          quantity,
          beforeQty: before,
          afterQty: after,
          reason: reason.trim(),
          createdBy: actorId,
        },
      });
      return { ...inventory, batch: updatedBatch };
    });
  }

  async commitPosSale(
    tx: Prisma.TransactionClient,
    storeId: string,
    lines: ReserveLine[],
    saleNumber: string,
    actorId: string,
  ) {
    for (const line of lines) {
      if (!line.saleItemId) {
        throw new BadRequestException({ code: 'SALE_ITEM_REQUIRED', message: 'Thieu dong hoa don de gan lo' });
      }
      const batches = await this.lockSellableBatches(
        tx,
        storeId,
        line.variantId,
        line.batchId,
      );
      const totalAvailable = batches.reduce(
        (sum, batch) => sum + Number(batch.quantity_on_hand) - Number(batch.reserved_quantity),
        0,
      );
      if (totalAvailable < line.quantity) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Khong du ton lo con han (can ${line.quantity}, con ${totalAvailable})`,
        });
      }
      let remaining = line.quantity;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const available = Number(batch.quantity_on_hand) - Number(batch.reserved_quantity);
        const allocated = Math.min(remaining, available);
        const before = Number(batch.quantity_on_hand);
        const after = before - allocated;
        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: {
            quantityOnHand: after,
            status: after === 0 ? InventoryBatchStatus.DEPLETED : InventoryBatchStatus.ACTIVE,
          },
        });
        await tx.pOSSaleItemBatchAllocation.create({
          data: { saleItemId: line.saleItemId, batchId: batch.id, quantity: allocated },
        });
        await tx.inventoryTransaction.create({
          data: {
            storeId,
            variantId: line.variantId,
            batchId: batch.id,
            type: InventoryTxType.POS_SALE,
            quantity: allocated,
            beforeQty: before,
            afterQty: after,
            reason: `POS sale ${saleNumber} (${line.batchId ? 'manual batch' : 'FEFO'})`,
            createdBy: actorId,
          },
        });
        remaining -= allocated;
      }
      const inventory = await tx.storeInventory.update({
        where: { storeId_variantId: { storeId, variantId: line.variantId } },
        data: { quantityOnHand: { decrement: line.quantity } },
      });
      if (Number(inventory.quantityOnHand) === 0) {
        await tx.storeInventory.update({ where: { id: inventory.id }, data: { status: 'OUT_OF_STOCK' } });
      }
    }
  }

  async returnPosSale(
    tx: Prisma.TransactionClient,
    storeId: string,
    lines: { saleItemId: string; variantId: string; quantity: number; restockable: boolean }[],
    saleNumber: string,
    actorId: string,
  ) {
    for (const line of lines) {
      const allocations = await tx.pOSSaleItemBatchAllocation.findMany({
        where: { saleItemId: line.saleItemId },
        include: { batch: true },
        orderBy: { createdAt: 'asc' },
      });
      let remaining = line.quantity;
      for (const allocation of allocations) {
        if (remaining <= 0) break;
        const returnable = Number(allocation.quantity) - Number(allocation.returnedQuantity);
        const quantity = Math.min(remaining, returnable);
        if (quantity <= 0) continue;
        const before = Number(allocation.batch.quantityOnHand);
        const after = line.restockable ? before + quantity : before;
        if (line.restockable) {
          await tx.inventoryBatch.update({
            where: { id: allocation.batchId },
            data: {
              quantityOnHand: after,
              status: this.restockedBatchStatus(allocation.batch.expiryDate, allocation.batch.status),
            },
          });
          await tx.storeInventory.update({
            where: { storeId_variantId: { storeId, variantId: line.variantId } },
            data: { quantityOnHand: { increment: quantity }, status: 'ACTIVE' },
          });
        }
        await tx.pOSSaleItemBatchAllocation.update({
          where: { id: allocation.id },
          data: { returnedQuantity: { increment: quantity } },
        });
        await tx.inventoryTransaction.create({
          data: {
            storeId,
            variantId: line.variantId,
            batchId: allocation.batchId,
            type: line.restockable ? InventoryTxType.POS_RETURN : InventoryTxType.POS_LOSS,
            quantity,
            beforeQty: before,
            afterQty: after,
            reason: line.restockable ? `POS return ${saleNumber}` : `POS return loss ${saleNumber}`,
            createdBy: actorId,
          },
        });
        remaining -= quantity;
      }
      if (remaining > 0) {
        throw new BadRequestException({ code: 'BATCH_ALLOCATION_MISSING', message: 'Khong du du lieu lo cua hang da ban de hoan' });
      }
    }
  }

  async restockReturnedItems(
    tx: Prisma.TransactionClient,
    storeId: string,
    lines: { orderItemId: string; variantId: string; quantity: number }[],
    orderId: string,
    actorId: string,
  ) {
    for (const line of lines) {
      const allocations = await tx.orderItemBatchAllocation.findMany({
        where: { orderItemId: line.orderItemId, status: BatchAllocationStatus.COMMITTED },
        include: { batch: true },
        orderBy: { createdAt: 'asc' },
      });
      let remaining = line.quantity;
      for (const allocation of allocations) {
        if (remaining <= 0) break;
        const returnable = Number(allocation.quantity) - Number(allocation.returnedQuantity);
        const quantity = Math.min(remaining, returnable);
        if (quantity <= 0) continue;
        const before = Number(allocation.batch.quantityOnHand);
        const after = before + quantity;
        await tx.inventoryBatch.update({
          where: { id: allocation.batchId },
          data: {
            quantityOnHand: after,
            status: this.restockedBatchStatus(allocation.batch.expiryDate, allocation.batch.status),
          },
        });
        await tx.orderItemBatchAllocation.update({
          where: { id: allocation.id },
          data: { returnedQuantity: { increment: quantity } },
        });
        await tx.storeInventory.update({
          where: { storeId_variantId: { storeId, variantId: line.variantId } },
          data: { quantityOnHand: { increment: quantity }, status: 'ACTIVE' },
        });
        await tx.inventoryTransaction.create({
          data: {
            storeId,
            variantId: line.variantId,
            batchId: allocation.batchId,
            type: InventoryTxType.POS_RETURN,
            quantity,
            beforeQty: before,
            afterQty: after,
            reason: 'Tra hang online ve dung lo goc',
            orderId,
            createdBy: actorId,
          },
        });
        remaining -= quantity;
      }
      if (remaining > 0) {
        throw new BadRequestException({ code: 'BATCH_ALLOCATION_MISSING', message: 'Khong du du lieu lo goc de hoan hang' });
      }
    }
  }
}
