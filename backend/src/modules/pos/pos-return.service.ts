import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { POSReturnStatus, POSSaleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { StoreScopeService } from '../store/store-scope.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateReturnDto } from './dto/pos.dto';

/**
 * POSReturnService - tra hang/hoan tien tai quay. Can quyen quan ly de approve.
 * Flow: REQUESTED -> APPROVED -> COMPLETED (cong ton neu restockable, hoac loss).
 */
@Injectable()
export class POSReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
    private readonly scope: StoreScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Tao yeu cau tra hang cho mot sale da PAID. Cashier/manager trong store. */
  async createReturn(user: AuthUser, dto: CreateReturnDto) {
    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: dto.saleId },
      include: { items: true },
    });
    if (!sale) {
      throw new NotFoundException({
        code: 'SALE_NOT_FOUND',
        message: 'Khong tim thay hoa don goc',
      });
    }
    await this.scope.assertStoreAccess(user.id, user.roles, sale.storeId);

    if (sale.status !== POSSaleStatus.PAID && sale.status !== POSSaleStatus.PARTIAL_REFUNDED) {
      throw new BadRequestException({
        code: 'SALE_NOT_RETURNABLE',
        message: 'Chi tra duoc hoa don da thanh toan',
      });
    }

    const itemMap = new Map(sale.items.map((it) => [it.id, it]));

    // P0-06: tong so luong da tra truoc do cho moi saleItem (REQUESTED/APPROVED/
    // COMPLETED) de khong cho tra vuot so luong da ban.
    const priorReturns = await this.prisma.pOSReturnItem.findMany({
      where: {
        saleItemId: { in: sale.items.map((it) => it.id) },
        returnRef: {
          originalSaleId: sale.id,
          status: {
            in: [
              POSReturnStatus.REQUESTED,
              POSReturnStatus.APPROVED,
              POSReturnStatus.COMPLETED,
            ],
          },
        },
      },
      select: { saleItemId: true, quantity: true },
    });
    const alreadyReturned = new Map<string, number>();
    for (const pr of priorReturns) {
      alreadyReturned.set(
        pr.saleItemId,
        (alreadyReturned.get(pr.saleItemId) ?? 0) + Number(pr.quantity),
      );
    }

    let refundAmount = 0;
    for (const line of dto.items) {
      const item = itemMap.get(line.saleItemId);
      if (!item) {
        throw new BadRequestException({
          code: 'ITEM_NOT_IN_SALE',
          message: 'San pham khong thuoc hoa don',
        });
      }
      const soldQty = Number(item.quantity);
      const prevQty = alreadyReturned.get(line.saleItemId) ?? 0;
      const remaining = soldQty - prevQty;
      if (line.quantity <= 0 || line.quantity > remaining) {
        throw new BadRequestException({
          code: 'INVALID_RETURN_QTY',
          message: `So luong tra khong hop le cho ${item.productNameSnapshot} (con co the tra: ${remaining})`,
        });
      }
      refundAmount += Math.round(item.unitPrice * line.quantity);
    }

    const ret = await this.prisma.pOSReturn.create({
      data: {
        originalSaleId: sale.id,
        storeId: sale.storeId,
        cashierId: user.id,
        reason: dto.reason,
        refundAmount,
        status: POSReturnStatus.REQUESTED,
        items: {
          create: dto.items.map((line) => {
            const item = itemMap.get(line.saleItemId)!;
            return {
              saleItemId: line.saleItemId,
              quantity: line.quantity,
              refundAmount: Math.round(item.unitPrice * line.quantity),
              restockable: line.restockable ?? true,
            };
          }),
        },
      },
      include: { items: true },
    });

    await this.audit.log({
      action: 'POS_RETURN_REQUESTED',
      actorId: user.id,
      targetType: 'POSReturn',
      targetId: ret.id,
      storeId: sale.storeId,
      metadata: { saleNumber: sale.saleNumber, refundAmount, reason: dto.reason },
    });
    return ret;
  }

  /** Manager duyet yeu cau tra hang. */
  async approve(user: AuthUser, returnId: string) {
    const ret = await this.getReturnInScope(user, returnId);
    if (ret.status !== POSReturnStatus.REQUESTED) {
      throw new BadRequestException({
        code: 'RETURN_NOT_PENDING',
        message: 'Yeu cau tra hang khong o trang thai cho duyet',
      });
    }
    const updated = await this.prisma.pOSReturn.update({
      where: { id: returnId },
      data: { status: POSReturnStatus.APPROVED, approvedBy: user.id },
    });
    await this.audit.log({
      action: 'POS_RETURN_APPROVED',
      actorId: user.id,
      targetType: 'POSReturn',
      targetId: returnId,
      storeId: ret.storeId,
      metadata: { refundAmount: ret.refundAmount },
    });
    return updated;
  }

  /**
   * Hoan tat tra hang: cong ton (restockable) hoac ghi loss, danh dau hoa don
   * goc REFUNDED/PARTIAL_REFUNDED, ghi audit.
   */
  async complete(user: AuthUser, returnId: string) {
    const ret = await this.prisma.pOSReturn.findUnique({
      where: { id: returnId },
      include: { items: true },
    });
    if (!ret) {
      throw new NotFoundException({
        code: 'RETURN_NOT_FOUND',
        message: 'Khong tim thay yeu cau tra hang',
      });
    }
    await this.scope.assertStoreAccess(user.id, user.roles, ret.storeId);
    if (ret.status !== POSReturnStatus.APPROVED) {
      throw new BadRequestException({
        code: 'RETURN_NOT_APPROVED',
        message: 'Yeu cau tra hang chua duoc duyet',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const sale = await tx.pOSSale.findUnique({
        where: { id: ret.originalSaleId },
        include: { items: true },
      });
      if (!sale) {
        throw new NotFoundException({
          code: 'SALE_NOT_FOUND',
          message: 'Khong tim thay hoa don goc',
        });
      }

      // Map saleItemId -> variantId
      const saleItemMap = new Map(sale.items.map((it) => [it.id, it]));
      const lines = ret.items.map((ri) => {
        const saleItem = saleItemMap.get(ri.saleItemId)!;
        return {
          variantId: saleItem.variantId,
          quantity: Number(ri.quantity),
          restockable: ri.restockable,
        };
      });

      await this.inventory.returnPosSale(
        tx,
        ret.storeId,
        lines,
        sale.saleNumber,
        user.id,
      );

      // Xac dinh refund toan bo hay mot phan
      const totalSaleQty = sale.items.reduce((s, it) => s + Number(it.quantity), 0);
      const totalReturnQty = ret.items.reduce((s, it) => s + Number(it.quantity), 0);
      const fullRefund = totalReturnQty >= totalSaleQty;

      await tx.pOSSale.update({
        where: { id: sale.id },
        data: {
          status: fullRefund
            ? POSSaleStatus.REFUNDED
            : POSSaleStatus.PARTIAL_REFUNDED,
        },
      });

      await tx.pOSReturn.update({
        where: { id: returnId },
        data: { status: POSReturnStatus.COMPLETED, completedAt: new Date() },
      });

      await this.audit.log(
        {
          action: 'POS_RETURN_COMPLETED',
          actorId: user.id,
          targetType: 'POSReturn',
          targetId: returnId,
          storeId: ret.storeId,
          metadata: {
            saleNumber: sale.saleNumber,
            refundAmount: ret.refundAmount,
            fullRefund,
          },
        },
        tx,
      );
    });

    return this.prisma.pOSReturn.findUnique({
      where: { id: returnId },
      include: { items: true },
    });
  }

  async listReturns(user: AuthUser, storeId?: string) {
    let scopeStoreId = storeId;
    if (!this.scope.isSystemAdmin(user.roles)) {
      scopeStoreId = await this.scope.requireUserStoreId(user.id);
    }
    return this.prisma.pOSReturn.findMany({
      where: { storeId: scopeStoreId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: true,
        originalSale: { select: { saleNumber: true } },
        cashier: { include: { profile: true } },
      },
    });
  }

  private async getReturnInScope(
    user: AuthUser,
    returnId: string,
    include?: Prisma.POSReturnInclude,
  ) {
    const ret = await this.prisma.pOSReturn.findUnique({
      where: { id: returnId },
      include,
    });
    if (!ret) {
      throw new NotFoundException({
        code: 'RETURN_NOT_FOUND',
        message: 'Khong tim thay yeu cau tra hang',
      });
    }
    await this.scope.assertStoreAccess(user.id, user.roles, ret.storeId);
    return ret;
  }
}
