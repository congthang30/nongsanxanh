import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export type CrossSellReason =
  | 'CO_PURCHASE'
  | 'FALLBACK_POPULAR'
  | 'FALLBACK_CATEGORY';

export interface CrossSellItem {
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  image: string | null;
  unit: string | null;
  fromPrice: number;
  available: number;
  reason: CrossSellReason;
  score: number;
}

export interface CrossSellResult {
  items: CrossSellItem[];
  source: 'co_purchase' | 'mixed' | 'fallback';
  pairRows: number;
}

/**
 * Market-basket co-occurrence (item-item), precomputed.
 * Online: chi doc bang product_co_purchases + hydrate SP — khong quet lai orders.
 */
@Injectable()
export class CoPurchaseService {
  private readonly logger = new Logger(CoPurchaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full rebuild: dem cap product trong don DELIVERED/COMPLETED.
   * O(sum n_i^2) theo so item/don — chay batch, khong phuc vu request cart.
   */
  async rebuildStats() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      },
      select: {
        id: true,
        items: { select: { productId: true } },
      },
    });

    const counts = new Map<string, number>();
    let multiItemOrders = 0;

    for (const order of orders) {
      const ids = [
        ...new Set(order.items.map((item) => item.productId).filter(Boolean)),
      ].sort();
      if (ids.length < 2) continue;
      multiItemOrders += 1;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = `${ids[i]}|${ids[j]}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }

    const rows = [...counts.entries()].map(([key, coCount]) => {
      const [productIdA, productIdB] = key.split('|');
      return { productIdA, productIdB, coCount };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.productCoPurchase.deleteMany({});
      if (rows.length === 0) return;
      // createMany chunks de tranh payload qua lon
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await tx.productCoPurchase.createMany({ data: chunk });
      }
    });

    this.logger.log(
      `Co-purchase rebuild: ${orders.length} orders, ${multiItemOrders} multi-item, ${rows.length} pairs`,
    );

    return {
      ordersScanned: orders.length,
      multiItemOrders,
      pairs: rows.length,
    };
  }

  /**
   * Recommend SP mua kem cho cart — doc cache + fallback nhe.
   */
  async recommendForCart(
    cartProductIds: string[],
    limit = 8,
  ): Promise<CrossSellResult> {
    const exclude = new Set(cartProductIds.filter(Boolean));
    if (exclude.size === 0) {
      return { items: [], source: 'fallback', pairRows: 0 };
    }

    const cartIds = [...exclude];
    const scoreMap = new Map<string, { score: number; reason: CrossSellReason }>();

    const pairRows = await this.prisma.productCoPurchase.findMany({
      where: {
        OR: [
          { productIdA: { in: cartIds } },
          { productIdB: { in: cartIds } },
        ],
      },
    });

    for (const row of pairRows) {
      const other =
        exclude.has(row.productIdA) && !exclude.has(row.productIdB)
          ? row.productIdB
          : exclude.has(row.productIdB) && !exclude.has(row.productIdA)
            ? row.productIdA
            : null;
      if (!other || exclude.has(other)) continue;
      const prev = scoreMap.get(other);
      const nextScore = (prev?.score ?? 0) + row.coCount;
      scoreMap.set(other, { score: nextScore, reason: 'CO_PURCHASE' });
    }

    let source: CrossSellResult['source'] =
      scoreMap.size > 0 ? 'co_purchase' : 'fallback';

    // Fallback popular neu thieu
    if (scoreMap.size < limit) {
      const popular = await this.popularProductIds(exclude, limit * 2);
      for (const id of popular) {
        if (scoreMap.size >= limit * 2) break;
        if (scoreMap.has(id) || exclude.has(id)) continue;
        scoreMap.set(id, { score: 0.1, reason: 'FALLBACK_POPULAR' });
        if (source === 'co_purchase') source = 'mixed';
      }
    }

    // Fallback cung category
    if (scoreMap.size < limit) {
      const catIds = await this.sameCategoryProductIds(cartIds, exclude, limit * 2);
      for (const id of catIds) {
        if (scoreMap.size >= limit * 2) break;
        if (scoreMap.has(id) || exclude.has(id)) continue;
        scoreMap.set(id, { score: 0.05, reason: 'FALLBACK_CATEGORY' });
        if (source === 'co_purchase') source = 'mixed';
        else if (source !== 'mixed') source = 'fallback';
      }
    }

    const ranked = [...scoreMap.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit * 2);

    const productIds = ranked.map(([id]) => id);
    if (productIds.length === 0) {
      return { items: [], source: 'fallback', pairRows: pairRows.length };
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        variants: { some: { status: 'ACTIVE' } },
      },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: {
          where: { status: 'ACTIVE' },
          orderBy: { price: 'asc' },
          take: 1,
        },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const variantIds = products
      .map((p) => p.variants[0]?.id)
      .filter((id): id is string => !!id);

    const invRows =
      variantIds.length === 0
        ? []
        : await this.prisma.storeInventory.groupBy({
            by: ['variantId'],
            where: { variantId: { in: variantIds }, status: 'ACTIVE' },
            _sum: { quantityOnHand: true, reservedQuantity: true },
          });
    const availMap = new Map<string, number>();
    for (const row of invRows) {
      const onHand = Number(row._sum.quantityOnHand ?? 0);
      const reserved = Number(row._sum.reservedQuantity ?? 0);
      availMap.set(row.variantId, Math.max(0, onHand - reserved));
    }

    const items: CrossSellItem[] = [];
    for (const [productId, meta] of ranked) {
      if (items.length >= limit) break;
      const product = byId.get(productId);
      const variant = product?.variants[0];
      if (!product || !variant) continue;
      const available = availMap.get(variant.id) ?? 0;
      if (available <= 0) continue;
      items.push({
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        slug: product.slug,
        image: product.images[0]?.url ?? null,
        unit: variant.unit,
        fromPrice: variant.price,
        available,
        reason: meta.reason,
        score: meta.score,
      });
    }

    return { items, source, pairRows: pairRows.length };
  }

  private async popularProductIds(
    exclude: Set<string>,
    take: number,
  ): Promise<string[]> {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { notIn: [...exclude] },
        order: {
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          createdAt: { gte: since },
        },
      },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take,
    });

    if (rows.length > 0) {
      return rows.map((r) => r.productId);
    }

    // Chua co don: lay SP ACTIVE bat ky (seed)
    const products = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        id: { notIn: [...exclude] },
        variants: { some: { status: 'ACTIVE' } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true },
    });
    return products.map((p) => p.id);
  }

  private async sameCategoryProductIds(
    cartProductIds: string[],
    exclude: Set<string>,
    take: number,
  ): Promise<string[]> {
    const cartProducts = await this.prisma.product.findMany({
      where: { id: { in: cartProductIds } },
      select: { categoryId: true },
    });
    const categoryIds = [
      ...new Set(cartProducts.map((p) => p.categoryId).filter(Boolean)),
    ];
    if (categoryIds.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: {
        categoryId: { in: categoryIds },
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        id: { notIn: [...exclude] },
        variants: { some: { status: 'ACTIVE' } },
      },
      orderBy: { ratingAvg: 'desc' },
      take,
      select: { id: true },
    });
    return products.map((p) => p.id);
  }
}
