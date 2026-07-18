import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiHttpService } from './ai-http.service';
import { AiVectorObjectType } from './ai-vector-sync.types';

interface DomainPointer {
  objectType: AiVectorObjectType;
  objectId: string;
  text: string;
  metadata: Prisma.InputJsonValue;
}

interface RelatedProductHit {
  objectId: string;
  score: number;
}

@Injectable()
export class AiVectorIndexerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiHttpService,
  ) {}

  async syncObject(objectType: AiVectorObjectType, objectId: string) {
    const pointer = await this.loadPointer(objectType, objectId);
    if (!pointer) {
      await this.inactivate(objectType, objectId);
      return { objectType, objectId, status: 'INACTIVE' as const };
    }

    if (pointer.objectType !== objectType) {
      await this.inactivate(objectType, objectId);
    }

    const [embedding] = await this.ai.embed(
      [pointer.text],
      'retrieval.passage',
    );
    if (!embedding) {
      throw new Error('Embedding service returned no vector');
    }
    await this.upsert(pointer, embedding);
    return {
      objectType: pointer.objectType,
      objectId,
      status: 'ACTIVE' as const,
    };
  }

  async reindexDomainObjects() {
    const now = new Date();
    const [products, coupons, knowledgeSources] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          deletedAt: null,
          variants: { some: { status: 'ACTIVE' } },
        },
        include: {
          variants: {
            where: { status: 'ACTIVE' },
            orderBy: { price: 'asc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.coupon.findMany({
        where: {
          status: 'ACTIVE',
          endsAt: { gte: now },
        },
        include: { store: { select: { name: true } } },
      }),
      this.prisma.knowledgeSource.findMany({
        where: {
          status: 'ACTIVE',
          AND: [
            { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
          ],
        },
      }),
    ]);

    // Prisma cannot express a column-to-column comparison on all supported
    // versions, so enforce coupon usage limits after loading the candidates.
    const validCoupons = coupons.filter(
      (coupon) =>
        coupon.usageLimit == null || coupon.usageCount < coupon.usageLimit,
    );
    const pointers: DomainPointer[] = [
      ...products.map((product) => this.productPointer(product)),
      ...validCoupons.map((coupon) => this.couponPointer(coupon)),
      ...knowledgeSources.map((source) => this.knowledgePointer(source)),
    ];

    const embeddings = await this.embedInBatches(
      pointers.map((pointer) => pointer.text),
      32,
    );
    if (embeddings.length !== pointers.length) {
      throw new BadRequestException({
        code: 'EMBEDDING_UNAVAILABLE',
        message: 'AI embedding service khong kha dung; index cu duoc giu nguyen',
      });
    }

    const inactivated = await this.prisma.$transaction(async (tx) => {
      const count = await tx.$executeRaw`
        UPDATE "ai_vector_index"
        SET "status" = 'INACTIVE', "updated_at" = NOW()
        WHERE "object_type" IN ('PRODUCT', 'COUPON', 'POLICY', 'FAQ')
      `;
      for (let index = 0; index < pointers.length; index++) {
        await this.upsert(pointers[index], embeddings[index], tx);
      }
      return count;
    });

    return {
      indexed: pointers.length,
      inactivated,
      products: products.length,
      coupons: validCoupons.length,
      knowledgeSources: knowledgeSources.length,
    };
  }

  async relatedProductIds(productId: string, limit = 24) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.prisma.$queryRaw<RelatedProductHit[]>(Prisma.sql`
      SELECT
        candidate."object_id" AS "objectId",
        1 - (candidate."embedding" <=> source."embedding") AS "score"
      FROM "ai_vector_index" AS source
      JOIN "ai_vector_index" AS candidate
        ON candidate."object_type" = 'PRODUCT'
       AND candidate."status" = 'ACTIVE'
       AND candidate."object_id" <> source."object_id"
      WHERE source."object_type" = 'PRODUCT'
        AND source."status" = 'ACTIVE'
        AND source."object_id" = ${productId}
      ORDER BY candidate."embedding" <=> source."embedding"
      LIMIT ${safeLimit}
    `);
  }

  async inactivateExpiredObjects() {
    const coupons = await this.prisma.$executeRaw`
      UPDATE "ai_vector_index" AS index
      SET "status" = 'INACTIVE', "updated_at" = NOW()
      FROM "coupons" AS coupon
      WHERE index."object_type" = 'COUPON'
        AND index."object_id" = coupon."id"
        AND index."status" = 'ACTIVE'
        AND (
          coupon."status" <> 'ACTIVE'
          OR coupon."ends_at" < NOW()
          OR (coupon."usage_limit" IS NOT NULL AND coupon."usage_count" >= coupon."usage_limit")
        )
    `;
    const knowledgeSources = await this.prisma.$executeRaw`
      UPDATE "ai_vector_index" AS index
      SET "status" = 'INACTIVE', "updated_at" = NOW()
      FROM "knowledge_sources" AS source
      WHERE index."object_type" IN ('POLICY', 'FAQ')
        AND index."object_id" = source."id"
        AND index."status" = 'ACTIVE'
        AND (
          source."status" <> 'ACTIVE'
          OR (source."effective_to" IS NOT NULL AND source."effective_to" < NOW())
        )
    `;
    return { coupons, knowledgeSources };
  }

  private async loadPointer(
    objectType: AiVectorObjectType,
    objectId: string,
  ): Promise<DomainPointer | null> {
    const now = new Date();
    if (objectType === 'PRODUCT') {
      const product = await this.prisma.product.findUnique({
        where: { id: objectId },
        include: {
          variants: {
            where: { status: 'ACTIVE' },
            orderBy: { price: 'asc' },
            take: 1,
          },
        },
      });
      if (
        !product ||
        product.status !== ProductStatus.ACTIVE ||
        product.deletedAt ||
        product.variants.length === 0
      ) {
        return null;
      }
      return this.productPointer(product);
    }

    if (objectType === 'COUPON') {
      const coupon = await this.prisma.coupon.findUnique({
        where: { id: objectId },
        include: { store: { select: { name: true } } },
      });
      if (
        !coupon ||
        coupon.status !== 'ACTIVE' ||
        coupon.endsAt < now ||
        (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit)
      ) {
        return null;
      }
      return this.couponPointer(coupon);
    }

    const source = await this.prisma.knowledgeSource.findUnique({
      where: { id: objectId },
    });
    if (
      !source ||
      source.status !== 'ACTIVE' ||
      (source.effectiveFrom && source.effectiveFrom > now) ||
      (source.effectiveTo && source.effectiveTo < now)
    ) {
      return null;
    }
    return this.knowledgePointer(source);
  }

  private productPointer(product: {
    id: string;
    name: string;
    originRegion: string | null;
    variants: { id: string; price: number; unit: string }[];
  }): DomainPointer {
    const variant = product.variants[0];
    return {
      objectType: 'PRODUCT',
      objectId: product.id,
      text:
        `Sản phẩm ${product.name}. Giá ${variant.price} VND` +
        `${variant.unit ? ` mỗi ${variant.unit}` : ''}. ` +
        `Xuất xứ ${product.originRegion ?? 'chưa cập nhật'}.`,
      metadata: { name: product.name, variantId: variant.id },
    };
  }

  private couponPointer(coupon: {
    id: string;
    code: string;
    name: string | null;
    type: string;
    value: number;
    minOrderValue: number;
    startsAt: Date;
    endsAt: Date;
    store: { name: string } | null;
  }): DomainPointer {
    return {
      objectType: 'COUPON',
      objectId: coupon.id,
      text:
        `Khuyến mãi ${coupon.name ?? coupon.code}, mã ${coupon.code}. ` +
        `Hiệu lực từ ${coupon.startsAt.toISOString()} đến ${coupon.endsAt.toISOString()}. ` +
        `Giảm ${coupon.value}${coupon.type === 'PERCENT' ? '%' : ' VND'}, ` +
        `đơn tối thiểu ${coupon.minOrderValue} VND` +
        `${coupon.store?.name ? ` tại cửa hàng ${coupon.store.name}` : ''}.`,
      metadata: {
        code: coupon.code,
        startsAt: coupon.startsAt.toISOString(),
        endsAt: coupon.endsAt.toISOString(),
      },
    };
  }

  private knowledgePointer(source: {
    id: string;
    code: string;
    type: string;
    title: string;
    content: string;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  }): DomainPointer {
    return {
      objectType: source.type === 'FAQ' ? 'FAQ' : 'POLICY',
      objectId: source.id,
      text: `${source.title}. ${source.content}`,
      metadata: {
        code: source.code,
        title: source.title,
        effectiveFrom: source.effectiveFrom?.toISOString() ?? null,
        effectiveTo: source.effectiveTo?.toISOString() ?? null,
      },
    };
  }

  private async upsert(
    pointer: DomainPointer,
    embedding: number[],
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const vector = this.vectorLiteral(embedding);
    const metadata = JSON.stringify(pointer.metadata);
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "ai_vector_index" (
        "id", "object_type", "object_id", "text", "embedding", "metadata", "status", "created_at", "updated_at"
      ) VALUES (
        ${randomUUID()}, ${pointer.objectType}, ${pointer.objectId}, ${pointer.text},
        ${vector}::vector, ${metadata}::jsonb, 'ACTIVE', NOW(), NOW()
      )
      ON CONFLICT ("object_type", "object_id") DO UPDATE SET
        "text" = EXCLUDED."text",
        "embedding" = EXCLUDED."embedding",
        "metadata" = EXCLUDED."metadata",
        "status" = 'ACTIVE',
        "updated_at" = NOW()
    `);
  }

  private async inactivate(objectType: AiVectorObjectType, objectId: string) {
    await this.prisma.$executeRaw`
      UPDATE "ai_vector_index"
      SET "status" = 'INACTIVE', "updated_at" = NOW()
      WHERE "object_type" = ${objectType} AND "object_id" = ${objectId}
    `;
  }

  private async embedInBatches(texts: string[], batchSize: number) {
    const embeddings: number[][] = [];
    for (let index = 0; index < texts.length; index += batchSize) {
      const batch = await this.ai.embed(
        texts.slice(index, index + batchSize),
        'retrieval.passage',
      );
      embeddings.push(...batch);
    }
    return embeddings;
  }

  private vectorLiteral(vector: number[]) {
    if (vector.some((value) => !Number.isFinite(value))) {
      throw new BadRequestException('Embedding contains invalid numbers');
    }
    return `[${vector.join(',')}]`;
  }
}
