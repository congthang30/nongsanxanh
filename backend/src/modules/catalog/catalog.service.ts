import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BarcodeType, Prisma, ProductStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { ProductQueryDto } from './dto/catalog.dto';

/**
 * Catalog service cho mo hinh chuoi cua hang.
 * San pham la GLOBAL (cua he thong), khong thuoc seller. Ton kho la cua tung store.
 * Day la danh muc tong; storefront theo store dung StoreService.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
  ) {}

  listCategories() {
    return this.prisma.category.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Danh muc san pham global (khong gan store). Dung cho admin / trang chung. */
  async listProducts(query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (!query.includeAll) where.status = ProductStatus.ACTIVE;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.origin)
      where.originRegion = { contains: query.origin, mode: 'insensitive' };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { originRegion: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.storeId) {
      where.variants = {
        some: {
          status: 'ACTIVE',
          storeInventories: {
            some: { storeId: query.storeId, status: 'ACTIVE' },
          },
        },
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy:
          query.sort === 'rating'
            ? { ratingAvg: 'desc' }
            : { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1 },
          variants: {
            where: {
              status: 'ACTIVE',
              ...(query.storeId
                ? { storeInventories: { some: { storeId: query.storeId, status: 'ACTIVE' } } }
                : {}),
            },
            orderBy: { price: 'asc' },
            take: 1,
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Ton kho GOP toan he thong cho variant dai dien (de hien con/het hang)
    const variantIds = items.map((p) => p.variants[0]?.id).filter(Boolean) as string[];
    const availMap = query.storeId
      ? await this.inventory.getAvailabilityMap(query.storeId, variantIds)
      : await this.inventory.getAggregateAvailabilityMap(variantIds);

    const data = items.map((p) => {
      const v0 = p.variants[0];
      const available = v0 ? availMap.get(v0.id) ?? 0 : 0;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        originRegion: p.originRegion,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        category: p.category,
        image: p.images[0]?.url ?? null,
        imageUrl: p.images[0]?.url ?? null,
        fromPrice: v0?.price ?? null,
        unit: v0?.unit ?? null,
        available,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProduct(identifier: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
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
    // Gan ton kho GOP toan he thong cho moi variant + so khu vuc con hang
    const variantIds = product.variants.map((v) => v.id);
    const availMap = query.storeId
      ? await this.inventory.getAvailabilityMap(query.storeId, variantIds)
      : await this.inventory.getAggregateAvailabilityMap(variantIds);
    const coverageMap = await this.inventory.getStoreCoverageMap(variantIds);

    // Lay thong tin chi tiet cac cua hang con san pham nay
    const storeInventories = await this.prisma.storeInventory.findMany({
      where: {
        variantId: { in: variantIds },
        status: 'ACTIVE',
        store: { status: 'ACTIVE' },
      },
      include: {
        store: {
          select: { id: true, name: true }
        }
      }
    });

    const variantStoresMap = new Map<string, { id: string; name: string; available: number }[]>();
    for (const si of storeInventories) {
      const avail = Math.max(0, Number(si.quantityOnHand) - Number(si.reservedQuantity));
      if (avail > 0) {
        const list = variantStoresMap.get(si.variantId) ?? [];
        list.push({
          id: si.store.id,
          name: si.store.name,
          available: avail,
        });
        variantStoresMap.set(si.variantId, list);
      }
    }

    return {
      ...product,
      variants: product.variants.map((v) => ({
        ...v,
        available: availMap.get(v.id) ?? 0,
        storeCoverage: coverageMap.get(v.id) ?? 0,
        stores: variantStoresMap.get(v.id) ?? [],
      })),
    };
  }

  async autocomplete(q: string) {
    if (!q || q.trim().length < 1) return [];
    return this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { originRegion: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, slug: true },
      take: 8,
      orderBy: { ratingCount: 'desc' },
    });
  }

  async relatedProducts(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, categoryId: true },
    });
    if (!product) return [];
    const items = await this.prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        id: { not: product.id },
      },
      take: 8,
      orderBy: { ratingAvg: 'desc' },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' }, take: 1 },
      },
    });
    return items.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      ratingAvg: p.ratingAvg,
      image: p.images[0]?.url ?? null,
      fromPrice: p.variants[0]?.price ?? null,
      unit: p.variants[0]?.unit ?? null,
    }));
  }

  // ============ Admin product management ============

  async getProductAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        attributes: true,
        variants: true,
      },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Khong tim thay san pham',
      });
    }
    return product;
  }

  async createProduct(dto: {
    name: string;
    slug: string;
    categoryId: string;
    description?: string;
    originRegion?: string;
    storageInstruction?: string;
    shelfLifeDays?: number;
    imageUrl?: string;
    variant: { sku: string; unit: string; unitValue?: number; price: number; compareAtPrice?: number };
  }) {
    const existing = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'PRODUCT_EXISTS',
        message: 'Slug san pham da ton tai',
      });
    }
    const sku = dto.variant.sku.trim().toUpperCase();
    const cleanSku = sku.replace(/[^A-Z0-9]/g, '').slice(0, 16) || 'ITEM';
    const barcode = `NSX-${cleanSku}-${randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        categoryId: dto.categoryId,
        description: dto.description,
        originRegion: dto.originRegion,
        storageInstruction: dto.storageInstruction,
        shelfLifeDays: dto.shelfLifeDays,
        status: ProductStatus.ACTIVE,
        images: dto.imageUrl
          ? { create: { url: dto.imageUrl, isPrimary: true } }
          : undefined,
        variants: {
          create: {
            sku,
            unit: dto.variant.unit,
            unitValue: dto.variant.unitValue ?? 1,
            price: dto.variant.price,
            compareAtPrice: dto.variant.compareAtPrice,
            barcode,
            status: 'ACTIVE',
            barcodes: {
              create: {
                barcode,
                type: BarcodeType.CODE128,
                isPrimary: true,
              },
            },
          },
        },
      },
      include: { variants: { include: { barcodes: true } }, images: true },
    });
  }

  async updateProduct(
    id: string,
    dto: {
      name?: string;
      categoryId?: string;
      description?: string;
      originRegion?: string;
      storageInstruction?: string;
      shelfLifeDays?: number;
      status?: string;
    },
  ) {
    await this.getProductAdmin(id);
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        description: dto.description,
        originRegion: dto.originRegion,
        storageInstruction: dto.storageInstruction,
        shelfLifeDays: dto.shelfLifeDays,
        status: dto.status as ProductStatus | undefined,
      },
    });
  }
}
