import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cac flash sale dang dien ra (cho trang chu / listing). */
  async activeFlashSales() {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        type: 'FLASH_SALE',
        status: { in: [CampaignStatus.SCHEDULED, CampaignStatus.ACTIVE] },
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
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
  async getActiveSalePrices(
    variantIds: string[],
    tx?: Prisma.TransactionClient,
    includeBatchSpecific = false,
  ): Promise<Map<string, number>> {
    const now = new Date();
    const items = await (tx ?? this.prisma).campaignItem.findMany({
      where: {
        variantId: { in: variantIds },
        ...(!includeBatchSpecific ? { batchId: null } : {}),
        campaign: {
          type: 'FLASH_SALE',
          status: { in: [CampaignStatus.SCHEDULED, CampaignStatus.ACTIVE] },
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
      },
      orderBy: { salePrice: 'asc' },
    });
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.quantityLimit != null && it.soldCount >= it.quantityLimit) continue;
      const key = it.batchId ? `${it.variantId}:${it.batchId}` : it.variantId;
      if (!map.has(key)) map.set(key, it.salePrice);
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

  async listSelectableBatches(variantId: string) {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        variantId,
        status: 'ACTIVE',
        expiryDate: { gte: today },
        quantityOnHand: { gt: 0 },
      },
      include: { store: { select: { id: true, name: true, code: true } } },
      orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
    });
    return batches.flatMap((batch) => {
      const available = Math.max(
        0,
        Number(batch.quantityOnHand) - Number(batch.reservedQuantity),
      );
      return available > 0
        ? [{
            id: batch.id,
            batchCode: batch.batchCode,
            variantId: batch.variantId,
            expiryDate: batch.expiryDate,
            available,
            store: batch.store,
          }]
        : [];
    });
  }

  async listCampaigns() {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: { type: 'FLASH_SALE' },
      include: {
        items: {
          include: {
            batch: {
              select: {
                id: true,
                batchCode: true,
                expiryDate: true,
                store: { select: { id: true, name: true } },
              },
            },
            variant: {
              select: {
                id: true,
                sku: true,
                unit: true,
                price: true,
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((campaign) => ({
      ...campaign,
      effectiveStatus:
        campaign.status === CampaignStatus.CANCELLED
          ? CampaignStatus.CANCELLED
          : now < campaign.startsAt
            ? CampaignStatus.SCHEDULED
            : now >= campaign.endsAt
              ? CampaignStatus.ENDED
              : CampaignStatus.ACTIVE,
    }));
  }

  async createCampaign(dto: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    items: { variantId: string; batchId?: string; salePrice: number; quantityLimit?: number }[];
  }) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const now = new Date();
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      startsAt >= endsAt ||
      startsAt <= now
    ) {
      throw new BadRequestException({
        code: 'CAMPAIGN_TIME_INVALID',
        message: 'Thời gian bắt đầu/kết thúc chương trình không hợp lệ',
      });
    }

    const variantIds = dto.items.map((item) => item.variantId);
    if (new Set(variantIds).size !== variantIds.length) {
      throw new BadRequestException({
        code: 'CAMPAIGN_VARIANT_DUPLICATED',
        message: 'Một phiên bản sản phẩm chỉ được chọn một lần',
      });
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, status: ProductStatus.ACTIVE },
      select: { id: true, price: true },
    });
    const priceByVariant = new Map(variants.map((variant) => [variant.id, variant.price]));
    const batchIds = dto.items.flatMap((item) => item.batchId ? [item.batchId] : []);
    const batches = batchIds.length
      ? await this.prisma.inventoryBatch.findMany({
          where: { id: { in: batchIds } },
          select: { id: true, variantId: true },
        })
      : [];
    const batchVariant = new Map(batches.map((batch) => [batch.id, batch.variantId]));
    for (const item of dto.items) {
      const regularPrice = priceByVariant.get(item.variantId);
      if (regularPrice == null) {
        throw new BadRequestException({
          code: 'CAMPAIGN_VARIANT_INVALID',
          message: 'Sản phẩm không tồn tại hoặc đã ngừng bán',
        });
      }
      if (item.batchId && batchVariant.get(item.batchId) !== item.variantId) {
        throw new BadRequestException({
          code: 'CAMPAIGN_BATCH_INVALID',
          message: 'Lô không tồn tại hoặc không thuộc phiên bản đã chọn',
        });
      }
      if (item.salePrice <= 0 || item.salePrice >= regularPrice) {
        throw new BadRequestException({
          code: 'CAMPAIGN_PRICE_INVALID',
          message: `Giá chương trình phải lớn hơn 0 và thấp hơn giá thường ${regularPrice}`,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('campaign-schedule'))`;
      const overlap = await tx.campaign.findFirst({
        where: {
          type: 'FLASH_SALE',
          status: { in: [CampaignStatus.SCHEDULED, CampaignStatus.ACTIVE] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          items: {
            some: {
              OR: dto.items.map((item) => ({
                variantId: item.variantId,
                batchId: item.batchId ?? null,
              })),
            },
          },
        },
        select: { name: true },
      });
      if (overlap) {
        throw new BadRequestException({
          code: 'CAMPAIGN_TIME_OVERLAP',
          message: `Sản phẩm đã có chương trình giá trùng thời gian: ${overlap.name}`,
        });
      }

      return tx.campaign.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          type: 'FLASH_SALE',
          startsAt,
          endsAt,
          status: CampaignStatus.SCHEDULED,
          items: {
            create: dto.items.map((it) => ({
              variantId: it.variantId,
              batchId: it.batchId,
              salePrice: it.salePrice,
              quantityLimit: it.quantityLimit,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async cancelCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!campaign) {
      throw new NotFoundException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Không tìm thấy chương trình giá',
      });
    }
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED },
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
