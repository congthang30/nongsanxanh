import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { StoreResolverService, ResolveInput } from './store-resolver.service';
import { ResolveStoreDto } from './dto/store.dto';

const SERVICEABLE_REASON_TEXT: Record<string, string> = {
  OK: 'Cua hang san sang phuc vu',
  NO_STORE_FOR_AREA: 'Khu vuc nay chua duoc cua hang nao phuc vu',
  STORE_OUT_OF_STOCK: 'Cua hang gan nhat khong du hang cho gio cua ban',
  STORE_NO_SHIPPER: 'Cua hang khu vuc nay tam thoi chua co shipper',
  NO_SERVICEABLE_STORE: 'Hien chua co cua hang phuc vu duoc dia chi nay',
};

/**
 * Dich vu storefront cho khach: resolve cua hang theo dia chi va liet ke
 * san pham co the mua tai cua hang do.
 */
@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: StoreResolverService,
    private readonly inventory: StoreInventoryService,
  ) {}

  /** Resolve cua hang phuc vu cho dia chi khach. */
  async resolveStore(dto: ResolveStoreDto, userId?: string) {
    const input = await this.buildResolveInput(dto, userId);
    const result = await this.resolver.resolve(input);
    return {
      ...result,
      message:
        SERVICEABLE_REASON_TEXT[result.reason] ?? SERVICEABLE_REASON_TEXT.OK,
    };
  }

  /** Chi tiet mot cua hang (public). */
  async getStorePublic(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, status: 'ACTIVE' },
      include: { serviceAreas: { where: { status: 'ACTIVE' } } },
    });
    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'Khong tim thay cua hang',
      });
    }
    return {
      id: store.id,
      code: store.code,
      name: store.name,
      slug: store.slug,
      province: store.province,
      district: store.district,
      ward: store.ward,
      addressLine: store.addressLine,
      formattedAddress: store.formattedAddress,
      phone: store.phone,
      openTime: store.openTime,
      closeTime: store.closeTime,
      serviceAreas: store.serviceAreas.map((a) => ({
        province: a.province,
        district: a.district,
        ward: a.ward,
      })),
    };
  }

  /**
   * Liet ke san pham co the mua tai mot cua hang (chi nhung variant co
   * StoreInventory ACTIVE va con ton kha dung).
   */
  async listProductsByStore(
    storeId: string,
    query: { q?: string; categoryId?: string; sort?: string; page?: number; limit?: number },
  ) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'Khong tim thay cua hang',
      });
    }

    // Lay inventory ACTIVE cua store
    const inventories = await this.prisma.storeInventory.findMany({
      where: { storeId, status: 'ACTIVE' },
      include: {
        variant: {
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true, slug: true } },
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    // Gom theo product, chi giu variant con hang
    type Row = (typeof inventories)[number];
    const byProduct = new Map<
      string,
      { product: Row['variant']['product']; rows: Row[] }
    >();
    for (const inv of inventories) {
      const available =
        Number(inv.quantityOnHand) - Number(inv.reservedQuantity);
      if (available <= 0) continue;
      const product = inv.variant.product;
      if (product.status !== ProductStatus.ACTIVE || product.deletedAt) continue;
      if (query.categoryId && product.categoryId !== query.categoryId) continue;
      if (query.q) {
        const q = query.q.toLowerCase();
        const hit =
          product.name.toLowerCase().includes(q) ||
          (product.originRegion ?? '').toLowerCase().includes(q);
        if (!hit) continue;
      }
      if (!byProduct.has(product.id)) {
        byProduct.set(product.id, { product, rows: [] });
      }
      byProduct.get(product.id)!.rows.push(inv);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 24, 100);
    let entries = Array.from(byProduct.values());

    // Sort
    if (query.sort === 'rating') {
      entries.sort((a, b) => b.product.ratingAvg - a.product.ratingAvg);
    } else {
      entries.sort(
        (a, b) =>
          new Date(b.product.createdAt).getTime() -
          new Date(a.product.createdAt).getTime(),
      );
    }

    const total = entries.length;
    entries = entries.slice((page - 1) * limit, page * limit);

    const data = entries.map(({ product, rows }) => {
      // variant re nhat con hang
      const cheapest = rows.reduce((min, r) => {
        const price = r.salePrice ?? r.priceOverride ?? r.variant.price;
        const minPrice =
          min.salePrice ?? min.priceOverride ?? min.variant.price;
        return price < minPrice ? r : min;
      });
      const price =
        cheapest.salePrice ?? cheapest.priceOverride ?? cheapest.variant.price;
      const available =
        Number(cheapest.quantityOnHand) - Number(cheapest.reservedQuantity);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        originRegion: product.originRegion,
        ratingAvg: product.ratingAvg,
        ratingCount: product.ratingCount,
        category: product.category,
        image: product.images[0]?.url ?? null,
        fromPrice: price,
        salePrice: cheapest.salePrice,
        unit: cheapest.variant.unit,
        available,
        storeId,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Chi tiet san pham tai mot cua hang (kem ton kha dung tung variant). */
  async getProductByStore(storeId: string, slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE, deletedAt: null },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        attributes: true,
        variants: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } },
      },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Khong tim thay san pham',
      });
    }
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, slug: true, province: true, district: true },
    });
    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'Khong tim thay cua hang',
      });
    }

    const variantIds = product.variants.map((v) => v.id);
    const availMap = await this.inventory.getAvailabilityMap(
      storeId,
      variantIds,
    );
    const priceMap = await this.inventory.getStorePrices(storeId, variantIds);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      originRegion: product.originRegion,
      storageInstruction: product.storageInstruction,
      shelfLifeDays: product.shelfLifeDays,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      category: product.category,
      images: product.images,
      attributes: product.attributes,
      store,
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        unit: v.unit,
        unitValue: v.unitValue,
        price: priceMap.get(v.id) ?? v.price,
        compareAtPrice: v.compareAtPrice,
        available: availMap.get(v.id) ?? 0,
      })),
    };
  }

  // ---------------- helpers ----------------

  private async buildResolveInput(
    dto: ResolveStoreDto,
    userId?: string,
  ): Promise<ResolveInput> {
    if (dto.addressId) {
      const address = await this.prisma.address.findFirst({
        where: { id: dto.addressId, ...(userId ? { userId } : {}) },
      });
      if (!address) {
        throw new BadRequestException({
          code: 'ADDRESS_INVALID',
          message: 'Dia chi khong hop le',
        });
      }
      return {
        lat: address.lat,
        lng: address.lng,
        province: address.province,
        district: address.district,
        ward: address.ward,
        cartItems: dto.cartItems,
      };
    }
    if (!dto.province && (dto.lat == null || dto.lng == null)) {
      throw new BadRequestException({
        code: 'ADDRESS_REQUIRED',
        message: 'Can dia chi hoac toa do de tim cua hang',
      });
    }
    return {
      lat: dto.lat,
      lng: dto.lng,
      province: dto.province,
      district: dto.district,
      ward: dto.ward,
      cartItems: dto.cartItems,
    };
  }
}
