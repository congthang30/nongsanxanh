import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiHttpService } from './ai-http.service';
import { ChatMemoryStore } from './chat-memory.store';
import { AiVectorIndexerService } from './ai-vector-indexer.service';

const SYSTEM_PROMPT = `Ban la tro ly ban hang cua NongSan Xanh.
Chi tra loi dua tren ngu canh va ket qua tool duoc cung cap. Khong bia dat gia, ton kho, khuyen mai hoac chinh sach.
Tra loi ngan gon, ro rang, bang tieng Viet. Neu khong co du lieu, hay noi ro la chua tim thay thong tin.`;

interface VectorHit {
  objectType: string;
  objectId: string;
  text: string;
  metadata: Prisma.JsonValue | null;
  score: number;
}

interface ResolvedContext {
  context: string;
  fallbackAnswer: string | null;
  cards: Record<string, unknown>[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly topK: number;
  private readonly scoreThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiHttpService,
    private readonly memory: ChatMemoryStore,
    private readonly indexer: AiVectorIndexerService,
    config: ConfigService,
  ) {
    this.topK = Math.max(
      1,
      Number(config.get<string>('VECTOR_SEARCH_TOP_K', '5')) || 5,
    );
    this.scoreThreshold = Number(
      config.get<string>('VECTOR_SCORE_THRESHOLD', '0.62'),
    );
  }

  async chat(params: {
    message: string;
    userId?: string;
    sessionId?: string;
    conversationId?: string;
  }) {
    const ownerKey = this.ownerKey(params.userId, params.sessionId);
    const conversationId = await this.memory.getOrCreate(
      params.conversationId,
      ownerKey,
    );
    await this.memory.append(conversationId, ownerKey, 'user', params.message);

    let cards: Record<string, unknown>[] = [];
    let answer = await this.answerProductQuery(params.message);

    if (
      !answer &&
      params.userId &&
      /don|order|giao|ship|huy|trang thai/i.test(params.message)
    ) {
      answer = await this.getOrderContext(params.userId);
    }

    if (!answer) {
      const hits = await this.searchVectorPointers(params.message);
      const resolved = await this.resolvePointers(hits, params.message);
      cards = resolved.cards;
      if (resolved.context) {
        answer =
          (await this.ai.generate(
            SYSTEM_PROMPT,
            `NGU CANH TOOL:\n${resolved.context}\n\nCAU HOI: ${params.message}`,
          )) ?? resolved.fallbackAnswer;
      } else {
        answer = await this.ai.generate(
          SYSTEM_PROMPT,
          `CAU HOI: ${params.message}`,
        );
      }
    }

    answer ??=
      'Hien toi chua tim thay thong tin phu hop. Ban co the hoi ve san pham, gia, ton kho, khuyen mai hoac don hang.';

    await this.memory.append(conversationId, ownerKey, 'assistant', answer);
    return { conversationId, answer, cards };
  }

  async history(conversationId: string, userId?: string, sessionId?: string) {
    return this.memory.history(
      conversationId,
      this.ownerKey(userId, sessionId),
    );
  }

  /** Rebuild semantic pointers from domain source-of-truth tables. */
  async reindexDomainObjects() {
    return this.indexer.reindexDomainObjects();
  }

  private async searchVectorPointers(query: string): Promise<VectorHit[]> {
    const [embedding] = await this.ai.embed([query], 'retrieval.query');
    if (!embedding) return [];
    const vector = this.vectorLiteral(embedding);

    try {
      return await this.prisma.$queryRaw<VectorHit[]>(Prisma.sql`
        SELECT
          "object_type" AS "objectType",
          "object_id" AS "objectId",
          "text",
          "metadata",
          1 - ("embedding" <=> ${vector}::vector) AS "score"
        FROM "ai_vector_index"
        WHERE "status" = 'ACTIVE'
          AND 1 - ("embedding" <=> ${vector}::vector) >= ${this.scoreThreshold}
        ORDER BY "embedding" <=> ${vector}::vector
        LIMIT ${this.topK}
      `);
    } catch (error) {
      this.logger.warn(`Vector search unavailable: ${(error as Error).message}`);
      return [];
    }
  }

  private async resolvePointers(
    hits: VectorHit[],
    message: string,
  ): Promise<ResolvedContext> {
    if (hits.length === 0) {
      return { context: '', fallbackAnswer: null, cards: [] };
    }

    const couponIds = hits
      .filter((hit) => hit.objectType === 'COUPON')
      .map((hit) => hit.objectId);
    const productIds = new Set(
      hits
        .filter((hit) => hit.objectType === 'PRODUCT')
        .map((hit) => hit.objectId),
    );
    const knowledgeIds = hits
      .filter((hit) => ['POLICY', 'FAQ'].includes(hit.objectType))
      .map((hit) => hit.objectId);
    const targetDate = this.extractTargetDate(message) ?? new Date();

    const coupons = couponIds.length
      ? await this.prisma.coupon.findMany({
          where: {
            id: { in: couponIds },
            status: 'ACTIVE',
            startsAt: { lte: targetDate },
            endsAt: { gte: targetDate },
          },
          include: { store: { select: { name: true } } },
        })
      : [];
    const validCoupons = coupons.filter(
      (coupon) =>
        coupon.usageLimit == null || coupon.usageCount < coupon.usageLimit,
    );

    const products = productIds.size
      ? (await this.loadActiveProducts()).filter((product) =>
          productIds.has(product.id),
        )
      : [];
    const knowledgeSources = knowledgeIds.length
      ? await this.prisma.knowledgeSource.findMany({
          where: {
            id: { in: knowledgeIds },
            status: 'ACTIVE',
            AND: [
              {
                OR: [
                  { effectiveFrom: null },
                  { effectiveFrom: { lte: targetDate } },
                ],
              },
              {
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: targetDate } },
                ],
              },
            ],
          },
        })
      : [];

    const contextLines = [
      ...validCoupons.map(
        (coupon) =>
          `COUPON ${coupon.id}: ma ${coupon.code}, ${coupon.name ?? 'khuyen mai'}, ` +
          `hieu luc ${coupon.startsAt.toISOString()} - ${coupon.endsAt.toISOString()}, ` +
          `gia tri ${coupon.value}${coupon.type === 'PERCENT' ? '%' : 'd'}, ` +
          `don toi thieu ${coupon.minOrderValue}d${coupon.store?.name ? `, cua hang ${coupon.store.name}` : ''}`,
      ),
      ...products.map(
        (product) =>
          `PRODUCT ${product.id}: ${product.name}, gia ${product.price}d${product.unit ? `/${product.unit}` : ''}, ton ${product.available ?? 0}`,
      ),
      ...knowledgeSources.map(
        (source) =>
          `${source.type} ${source.id}: ${source.title}. ${source.content}`,
      ),
    ];

    const fallbackLines = [
      ...validCoupons.map(
        (coupon) =>
          `- ${coupon.name ?? coupon.code} (ma ${coupon.code}): giam ${coupon.value}${coupon.type === 'PERCENT' ? '%' : 'd'}, het han ${coupon.endsAt.toLocaleDateString('vi-VN')}`,
      ),
      ...products.map(
        (product) =>
          `- ${product.name}: ${this.vnd(product.price)}${product.unit ? `/${product.unit}` : ''}`,
      ),
    ];

    const cards = validCoupons.map((coupon) => ({
      type: 'coupon',
      id: coupon.id,
      code: coupon.code,
      title: coupon.name ?? coupon.code,
      value: coupon.value,
      discountType: coupon.type,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      storeName: coupon.store?.name ?? null,
    }));

    const policyFallback = knowledgeSources[0]
      ? `${knowledgeSources[0].title}: ${knowledgeSources[0].content}`
      : null;
    const fallbackAnswer = fallbackLines.length
      ? `Thong tin phu hop:\n${fallbackLines.join('\n')}`
      : policyFallback ?? null;

    return {
      context: contextLines.join('\n'),
      fallbackAnswer,
      cards,
    };
  }

  // ---- Product tools ----

  private async answerProductQuery(message: string): Promise<string | null> {
    const norm = this.normalize(message);
    const listIntent =
      /(liet ke|danh sach|nhung san pham|cac san pham|san pham (nao|gi|dang co)|co (nhung )?san pham|ban (nhung )?gi|co gi|menu|catalog)/.test(
        norm,
      );
    const priceIntent = /\bgia\b|bao nhieu tien|gia bao nhieu|gia ca/.test(norm);
    const stockIntent =
      /con hang|con bao nhieu|ton kho|het hang|so luong|con khong/.test(norm);
    const shopIntent =
      /shop (nao|gi)|gian hang (nao|gi)|cua hang (nao|gi)|nha vuon (nao|gi)|ai ban|ban tu shop/.test(
        norm,
      );

    if (!listIntent && !priceIntent && !stockIntent && !shopIntent) return null;
    const products = await this.loadActiveProducts();
    if (products.length === 0) return null;

    if (listIntent && !priceIntent && !stockIntent) {
      const lines = products.map(
        (product) =>
          `- ${product.name}: ${this.vnd(product.price)}${product.unit ? `/${product.unit}` : ''}` +
          (product.available != null ? ` (con ${product.available})` : ''),
      );
      return `Hien tai NongSan Xanh dang co ${products.length} san pham:\n${lines.join('\n')}`;
    }

    const matched = this.matchProduct(message, products);
    if (priceIntent) {
      if (matched) {
        return `Gia ${matched.name} la ${this.vnd(matched.price)}${matched.unit ? `/${matched.unit}` : ''}.`;
      }
      return `Bang gia cac san pham hien co:\n${products
        .map(
          (product) =>
            `- ${product.name}: ${this.vnd(product.price)}${product.unit ? `/${product.unit}` : ''}`,
        )
        .join('\n')}`;
    }

    if (stockIntent) {
      if (matched) {
        const available = matched.available ?? 0;
        return available > 0
          ? `${matched.name} dang con ${available}${matched.unit ? ` ${matched.unit}` : ''}.`
          : `${matched.name} hien da het hang.`;
      }
      const inStock = products.filter((product) => (product.available ?? 0) > 0);
      return inStock.length
        ? `Cac san pham con hang:\n${inStock.map((product) => `- ${product.name}: con ${product.available}`).join('\n')}`
        : 'Hien tat ca san pham tam het hang.';
    }

    if (shopIntent && matched) {
      return `${matched.name} co gia ${this.vnd(matched.price)}${matched.unit ? `/${matched.unit}` : ''}. Ton kho duoc tong hop tren cac cua hang dang hoat dong.`;
    }
    return null;
  }

  private async loadActiveProducts() {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, deletedAt: null },
      include: {
        variants: {
          where: { status: 'ACTIVE' },
          orderBy: { price: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return Promise.all(
      products.map(async (product) => {
        const variant = product.variants[0];
        let available: number | null = null;
        if (variant) {
          const aggregate = await this.prisma.storeInventory.aggregate({
            where: { variantId: variant.id, status: 'ACTIVE' },
            _sum: { quantityOnHand: true, reservedQuantity: true },
          });
          available =
            Number(aggregate._sum.quantityOnHand ?? 0) -
            Number(aggregate._sum.reservedQuantity ?? 0);
        }
        return {
          id: product.id,
          name: product.name,
          price: variant?.price ?? 0,
          unit: variant?.unit ?? null,
          originRegion: product.originRegion,
          available,
          variantId: variant?.id ?? null,
        };
      }),
    );
  }

  private matchProduct<T extends { name: string }>(message: string, products: T[]) {
    const normalizedMessage = this.normalize(message);
    let best: { product: T; score: number } | null = null;
    for (const product of products) {
      const tokens = this.normalize(product.name)
        .split(' ')
        .filter((token) => token.length >= 2);
      const hits = tokens.filter((token) => normalizedMessage.includes(token)).length;
      const score = tokens.length ? hits / tokens.length : 0;
      if (hits > 0 && (!best || score > best.score)) {
        best = { product, score };
      }
    }
    return best && best.score >= 0.5 ? best.product : null;
  }

  private async getOrderContext(userId: string): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { items: true },
    });
    if (orders.length === 0) return 'Ban chua co don hang nao.';
    return (
      'Don hang gan day cua ban:\n' +
      orders
        .map(
          (order) =>
            `- ${order.orderNumber}: ${order.status}, tong ${this.vnd(order.grandTotal)}, ${order.items.length} san pham`,
        )
        .join('\n')
    );
  }

  private ownerKey(userId?: string, sessionId?: string) {
    if (userId) return `user:${userId}`;
    if (sessionId?.trim()) return `session:${sessionId.trim()}`;
    throw new BadRequestException({
      code: 'SESSION_REQUIRED',
      message: 'Thieu x-session-id cho phien chat an danh',
    });
  }

  private extractTargetDate(message: string): Date | null {
    const match = message.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if (!match) return null;
    const now = new Date();
    const yearValue = match[3] ? Number(match[3]) : now.getFullYear();
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]), 12, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== Number(match[2]) - 1 ||
      date.getDate() !== Number(match[1])
    ) {
      return null;
    }
    return date;
  }

  private vectorLiteral(vector: number[]) {
    if (vector.some((value) => !Number.isFinite(value))) {
      throw new BadRequestException('Embedding contains invalid numbers');
    }
    return `[${vector.join(',')}]`;
  }

  private normalize(text: string) {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u0111\u0110]/g, 'd')
      .toLowerCase();
  }

  private vnd(value: number) {
    return `${Math.round(value).toLocaleString('vi-VN')}d`;
  }
}
