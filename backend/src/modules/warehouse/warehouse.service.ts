import { Injectable } from '@nestjs/common';
import { InventoryTxType } from '@prisma/client';
import { StoreInventoryService } from '../inventory/inventory.service';
import { StoreScopeService } from '../store/store-scope.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdjustStockDto, ExportStockDto, ImportStockDto } from './dto/warehouse.dto';

/**
 * Service cho nhan vien kho cua cua hang. Tat ca thao tac scope theo store
 * cua user (chong IDOR). Khong con kho trung tam.
 */
@Injectable()
export class WarehouseService {
  constructor(
    private readonly inventory: StoreInventoryService,
    private readonly scope: StoreScopeService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveStoreId(user: AuthUser) {
    if (this.scope.isSystemAdmin(user.roles)) {
      const store = await this.prisma.store.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (store) return store.id;
    }
    return this.scope.requireUserStoreId(user.id);
  }

  async listInventory(user: AuthUser, q?: string, lowStockOnly?: boolean) {
    const storeId = await this.resolveStoreId(user);
    return this.inventory.listInventory(storeId, { q, lowStockOnly });
  }

  async listLowStock(user: AuthUser) {
    const storeId = await this.resolveStoreId(user);
    return this.inventory.listInventory(storeId, { lowStockOnly: true });
  }

  async listTransactions(
    user: AuthUser,
    filter: { variantId?: string; type?: string; from?: string; to?: string },
  ) {
    const storeId = await this.resolveStoreId(user);
    return this.inventory.listTransactions(storeId, {
      variantId: filter.variantId,
      type: filter.type ? (filter.type as InventoryTxType) : undefined,
      from: filter.from,
      to: filter.to,
    });
  }

  async importStock(user: AuthUser, dto: ImportStockDto) {
    const storeId = await this.resolveStoreId(user);
    const result = await this.inventory.importStock(
      storeId,
      dto.variantId,
      dto.quantity,
      {
        batchCode: dto.batchCode,
        receivedDate: dto.receivedDate,
        expiryDate: dto.expiryDate,
      },
      dto.reason,
      user.id,
    );
    await this.audit.log({
      action: 'INVENTORY_IMPORT',
      actorId: user.id,
      targetType: 'StoreInventory',
      targetId: result.id,
      storeId,
      metadata: {
        variantId: dto.variantId,
        batchId: result.batch.id,
        batchCode: dto.batchCode,
        receivedDate: dto.receivedDate,
        expiryDate: dto.expiryDate,
        quantity: dto.quantity,
        reason: dto.reason,
      },
    });
    return result;
  }

  async adjustStock(user: AuthUser, dto: AdjustStockDto) {
    const storeId = await this.resolveStoreId(user);
    const result = await this.inventory.adjustStock(
      storeId,
      dto.variantId,
      dto.batchId,
      dto.newQuantity,
      dto.reason,
      user.id,
    );
    await this.audit.log({
      action: 'INVENTORY_ADJUST',
      actorId: user.id,
      targetType: 'StoreInventory',
      targetId: result.id,
      storeId,
      metadata: {
        variantId: dto.variantId,
        batchId: dto.batchId,
        newQuantity: dto.newQuantity,
        reason: dto.reason,
      },
    });
    return result;
  }

  /** Xuat kho hoac danh hu hang. Reason bat buoc. */
  async exportStock(user: AuthUser, dto: ExportStockDto) {
    const storeId = await this.resolveStoreId(user);
    const kind = dto.kind ?? 'EXPORT';
    const result = await this.inventory.exportStock(
      storeId,
      dto.variantId,
      dto.batchId,
      dto.quantity,
      dto.reason,
      kind,
      user.id,
    );
    await this.audit.log({
      action: kind === 'LOSS' ? 'INVENTORY_LOSS' : 'INVENTORY_EXPORT',
      actorId: user.id,
      targetType: 'InventoryBatch',
      targetId: dto.batchId,
      storeId,
      metadata: {
        variantId: dto.variantId,
        batchId: dto.batchId,
        quantity: dto.quantity,
        reason: dto.reason,
        kind,
      },
    });
    return result;
  }
}
