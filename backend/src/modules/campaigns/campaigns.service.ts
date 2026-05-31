import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cac flash sale dang dien ra (cho trang chu / listing). */
  async activeFlashSales() {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: { type: 'FLASH_SALE', status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: { images: { where: { isPrimary: true }, take: 1 } },
                },
              },
            },
          },
        },
      },
    });
    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      endsAt: c.endsAt,
      items: c.items.map((it) => ({
        variantId: it.variantId,
        productName: it.variant.product.name,
        productSlug: it.variant.product.slug,
        image: it.variant.product.images[0]?.url ?? null,
        unit: it.variant.unit,
        originalPrice: it.variant.price,
        salePrice: it.salePrice,
        quantityLimit: it.quantityLimit,
        soldCount: it.soldCount,
      })),
    }));
  }

  /**
   * Tra ve map variantId -> salePrice cho cac flash sale dang chay.
   * Dung trong Cart/Order de uu tien gia sale.
   */
  async getActiveSalePrices(variantIds: string[]): Promise<Map<string, number>> {
    const now = new Date();
    const items = await this.prisma.campaignItem.findMany({
      where: {
        variantId: { in: variantIds },
        campaign: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
      },
      orderBy: { salePrice: 'asc' },
    });
    const map = new Map<string, number>();
    for (const it of items) {
      // Con suat ban (neu co gioi han)
      if (it.quantityLimit != null && it.soldCount >= it.quantityLimit) continue;
      if (!map.has(it.variantId)) map.set(it.variantId, it.salePrice);
    }
    return map;
  }

  listCombos() {
    return this.prisma.combo.findMany({
      where: { status: 'ACTIVE' },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
              },
            },
          },
        },
      },
    });
  }

  // ---- Admin ----
  createCampaign(dto: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    items: { variantId: string; salePrice: number; quantityLimit?: number }[];
  }) {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: 'FLASH_SALE',
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        status: 'ACTIVE',
        items: {
          create: dto.items.map((it) => ({
            variantId: it.variantId,
            salePrice: it.salePrice,
            quantityLimit: it.quantityLimit,
          })),
        },
      },
      include: { items: true },
    });
  }

  createCombo(dto: {
    name: string;
    slug: string;
    description?: string;
    imageUrl?: string;
    price: number;
    items: { variantId: string; quantity: number }[];
  }) {
    return this.prisma.combo.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        price: dto.price,
        items: { create: dto.items.map((it) => ({ variantId: it.variantId, quantity: it.quantity })) },
      },
      include: { items: true },
    });
  }
}
