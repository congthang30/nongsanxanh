import { Injectable } from '@nestjs/common';
import { InventoryTxType } from '@prisma/client';
import { StoreInventoryService } from '../inventory/inventory.service';
import { StoreScopeService } from '../store/store-scope.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

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
  ) {}

  async listInventory(user: AuthUser, q?: string, lowStockOnly?: boolean) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    return this.inventory.listInventory(storeId, { q, lowStockOnly });
  }

  async listLowStock(user: AuthUser) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    return this.inventory.listInventory(storeId, { lowStockOnly: true });
  }

  async listTransactions(
    user: AuthUser,
    filter: { variantId?: string; type?: string; from?: string; to?: string },
  ) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    return this.inventory.listTransactions(storeId, {
      variantId: filter.variantId,
      type: filter.type ? (filter.type as InventoryTxType) : undefined,
      from: filter.from,
      to: filter.to,
    });
  }

  async importStock(
    user: AuthUser,
    variantId: string,
    quantity: number,
    reason?: string,
  ) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    const result = await this.inventory.importStock(
      storeId,
      variantId,
      quantity,
      reason,
      user.id,
    );
    await this.audit.log({
      action: 'INVENTORY_IMPORT',
      actorId: user.id,
      targetType: 'StoreInventory',
      targetId: result.id,
      storeId,
      metadata: { variantId, quantity, reason },
    });
    return result;
  }

  async adjustStock(
    user: AuthUser,
    variantId: string,
    newQuantity: number,
    reason?: string,
  ) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    const result = await this.inventory.adjustStock(
      storeId,
      variantId,
      newQuantity,
      reason,
      user.id,
    );
    await this.audit.log({
      action: 'INVENTORY_ADJUST',
      actorId: user.id,
      targetType: 'StoreInventory',
      targetId: result.id,
      storeId,
      metadata: { variantId, newQuantity, reason },
    });
    return result;
  }

  /** Xuat kho hoac danh hu hang. Reason bat buoc. */
  async exportStock(
    user: AuthUser,
    variantId: string,
    quantity: number,
    reason: string,
    kind: 'EXPORT' | 'LOSS',
  ) {
    const storeId = await this.scope.requireUserStoreId(user.id);
    const result = await this.inventory.exportStock(
      storeId,
      variantId,
      quantity,
      reason,
      kind,
      user.id,
    );
    await this.audit.log({
      action: kind === 'LOSS' ? 'INVENTORY_LOSS' : 'INVENTORY_EXPORT',
      actorId: user.id,
      targetType: 'StoreInventory',
      targetId: result.id,
      storeId,
      metadata: { variantId, quantity, reason, kind },
    });
    return result;
  }
}
