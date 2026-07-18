import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BarcodeStatus, BarcodeType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import { StoreInventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { CreateBarcodeDto, UpdateBarcodeDto } from './dto/pos.dto';

/**
 * Ket qua lookup mot barcode tai mot cua hang cu the (POS).
 * Gia + ton kho LAY THEO store cua cashier (khong resolve theo dia chi).
 */
export interface BarcodeLookupResult {
  barcode: string;
  barcodeType: BarcodeType;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  unit: string;
  saleMode: 'UNIT' | 'WEIGHT';
  allowDecimalQuantity: boolean;
  unitPrice: number;
  available: number;
  inStock: boolean;
}

/**
 * Quan ly ma vach (barcode) gan voi ProductVariant + lookup/search san pham
 * cho POS. Barcode unique toan he thong. Lookup tra gia/ton theo store cashier.
 */
@Injectable()
export class BarcodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Lookup mot barcode cho POS tai store cua cashier.
   * - Barcode khong ton tai -> 404 BARCODE_NOT_FOUND
   * - Barcode INACTIVE       -> 400 BARCODE_INACTIVE ("Ma vach da ngung dung")
   * - Variant INACTIVE       -> 400 VARIANT_INACTIVE
   * Tra ve gia + ton kha dung theo store (available co the = 0).
   */
  async lookup(storeId: string, rawBarcode: string): Promise<BarcodeLookupResult> {
    const barcode = rawBarcode.trim();
    if (!barcode) {
      throw new BadRequestException({
        code: 'BARCODE_EMPTY',
        message: 'Chua nhap ma vach',
      });
    }

    const record = await this.prisma.productBarcode.findUnique({
      where: { barcode },
      include: { variant: { include: { product: true } } },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'BARCODE_NOT_FOUND',
        message: `Khong tim thay san pham voi ma vach ${barcode}`,
      });
    }
    if (record.status !== BarcodeStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'BARCODE_INACTIVE',
        message: 'Ma vach da ngung dung',
      });
    }
    const variant = record.variant;
    if (!variant || variant.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'VARIANT_INACTIVE',
        message: 'San pham nay da ngung kinh doanh',
      });
    }

    const inv = await this.prisma.storeInventory.findUnique({
      where: { storeId_variantId: { storeId, variantId: variant.id } },
    });
    const available =
      inv && inv.status === 'ACTIVE'
        ? Number(inv.quantityOnHand) - Number(inv.reservedQuantity)
        : 0;
    const unitPrice =
      inv?.salePrice ?? inv?.priceOverride ?? variant.price;

    return {
      barcode: record.barcode,
      barcodeType: record.type,
      productId: variant.productId,
      variantId: variant.id,
      productName: variant.product.name,
      sku: variant.sku,
      unit: variant.unit,
      saleMode: variant.saleMode,
      allowDecimalQuantity: variant.allowDecimalQuantity,
      unitPrice,
      available,
      inStock: available > 0,
    };
  }

  /**
   * Tim san pham thu cong tai store cua cashier (khi barcode hong).
   * Tra danh sach variant co ton kho tai store, kem barcode chinh + gia.
   */
  async search(storeId: string, q: string) {
    const term = (q ?? '').trim();
    if (term.length < 1) return [];

    const rows = await this.prisma.storeInventory.findMany({
      where: {
        storeId,
        variant: {
          status: 'ACTIVE',
          OR: [
            { sku: { contains: term, mode: 'insensitive' } },
            { product: { name: { contains: term, mode: 'insensitive' } } },
            { barcodes: { some: { barcode: { contains: term } } } },
          ],
        },
      },
      include: {
        variant: {
          include: {
            product: { select: { id: true, name: true } },
            barcodes: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } },
          },
        },
      },
      take: 30,
    });

    return rows.map((r) => {
      const available = r.status === 'ACTIVE'
        ? Number(r.quantityOnHand) - Number(r.reservedQuantity)
        : 0;
      const primary = r.variant.barcodes.find((b) => b.isPrimary) ?? r.variant.barcodes[0];
      return {
        productId: r.variant.productId,
        variantId: r.variantId,
        productName: r.variant.product.name,
        sku: r.variant.sku,
        unit: r.variant.unit,
        saleMode: r.variant.saleMode,
        allowDecimalQuantity: r.variant.allowDecimalQuantity,
        barcode: primary?.barcode ?? null,
        unitPrice: r.salePrice ?? r.priceOverride ?? r.variant.price,
        available,
        inStock: available > 0,
      };
    });
  }

  // ---------------- Admin barcode CRUD ----------------

  async listBarcodes(opts?: { q?: string; variantId?: string }) {
    const term = opts?.q?.trim();
    const rows = await this.prisma.productBarcode.findMany({
      where: {
        variantId: opts?.variantId,
        ...(term
          ? {
              OR: [
                { barcode: { contains: term } },
                { variant: { sku: { contains: term, mode: 'insensitive' } } },
                {
                  variant: {
                    product: { name: { contains: term, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        variant: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((b) => ({
      id: b.id,
      barcode: b.barcode,
      type: b.type,
      isPrimary: b.isPrimary,
      status: b.status,
      variantId: b.variantId,
      sku: b.variant.sku,
      productId: b.variant.productId,
      productName: b.variant.product.name,
      unit: b.variant.unit,
      createdAt: b.createdAt,
    }));
  }

  async renderCode(id: string, format: 'barcode' | 'qr'): Promise<Buffer> {
    const record = await this.prisma.productBarcode.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException({
        code: 'BARCODE_NOT_FOUND',
        message: 'Khong tim thay ma vach',
      });
    }
    if (format === 'qr') {
      return QRCode.toBuffer(record.barcode, {
        type: 'png',
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
    }
    return bwipjs.toBuffer({
      bcid: 'code128',
      text: record.barcode,
      scale: 3,
      height: 14,
      includetext: true,
      textxalign: 'center',
    });
  }

  async createBarcode(variantId: string, dto: CreateBarcodeDto, actorId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: 'Khong tim thay variant',
      });
    }
    const barcode = dto.barcode.trim();
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Neu dat isPrimary, bo primary cu cua variant
        if (dto.isPrimary) {
          await tx.productBarcode.updateMany({
            where: { variantId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        return tx.productBarcode.create({
          data: {
            variantId,
            barcode,
            type: dto.type ?? BarcodeType.EAN13,
            isPrimary: dto.isPrimary ?? false,
          },
        });
      });
      await this.audit.log({
        action: 'POS_BARCODE_CREATED',
        actorId,
        targetType: 'ProductBarcode',
        targetId: created.id,
        metadata: { variantId, barcode, type: created.type },
      });
      return created;
    } catch (e) {
      this.rethrowUnique(e, barcode);
    }
  }

  async updateBarcode(id: string, dto: UpdateBarcodeDto, actorId: string) {
    const existing = await this.prisma.productBarcode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'BARCODE_NOT_FOUND',
        message: 'Khong tim thay ma vach',
      });
    }
    const barcode = dto.barcode?.trim();
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) {
          await tx.productBarcode.updateMany({
            where: { variantId: existing.variantId, isPrimary: true, id: { not: id } },
            data: { isPrimary: false },
          });
        }
        return tx.productBarcode.update({
          where: { id },
          data: {
            barcode: barcode ?? undefined,
            type: dto.type ?? undefined,
            isPrimary: dto.isPrimary ?? undefined,
            status: dto.status ?? undefined,
          },
        });
      });
      await this.audit.log({
        action: 'POS_BARCODE_UPDATED',
        actorId,
        targetType: 'ProductBarcode',
        targetId: id,
        metadata: { ...dto },
      });
      return updated;
    } catch (e) {
      this.rethrowUnique(e, barcode ?? existing.barcode);
    }
  }

  async deleteBarcode(id: string, actorId: string) {
    const existing = await this.prisma.productBarcode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'BARCODE_NOT_FOUND',
        message: 'Khong tim thay ma vach',
      });
    }
    await this.prisma.productBarcode.delete({ where: { id } });
    await this.audit.log({
      action: 'POS_BARCODE_DELETED',
      actorId,
      targetType: 'ProductBarcode',
      targetId: id,
      metadata: { barcode: existing.barcode, variantId: existing.variantId },
    });
    return { ok: true };
  }

  private rethrowUnique(e: unknown, barcode: string): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'BARCODE_DUPLICATE',
        message: `Ma vach ${barcode} da ton tai trong he thong`,
      });
    }
    throw e;
  }
}
