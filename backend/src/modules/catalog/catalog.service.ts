import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ProductQueryDto } from './dto/catalog.dto';

/**
 * Catalog service cho mo hinh chuoi cua hang.
 * San pham la GLOBAL (cua he thong), khong thuoc seller. Ton kho la cua tung store.
 * Day la danh muc tong; storefront theo store dung StoreService.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

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
          variants: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' }, take: 1 },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const data = items.map((p) => {
      const v0 = p.variants[0];
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
        fromPrice: v0?.price ?? null,
        unit: v0?.unit ?? null,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProductBySlug(slug: string) {
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
    return product;
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
            sku: dto.variant.sku,
            unit: dto.variant.unit,
            unitValue: dto.variant.unitValue ?? 1,
            price: dto.variant.price,
            compareAtPrice: dto.variant.compareAtPrice,
            status: 'ACTIVE',
          },
        },
      },
      include: { variants: true, images: true },
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
