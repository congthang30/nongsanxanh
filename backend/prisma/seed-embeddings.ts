/* eslint-disable no-console */
/**
 * Sau khi seed domain data: goi AI service embed text va ghi vao pgvector (ai_vector_index).
 * Chay trong prisma/seed.ts — khong can goi POST /ai/reindex thu cong.
 *
 * Env:
 *   AI_SERVICE_URL              default http://localhost:8000 (Docker: http://ai-service:8000)
 *   AI_EMBEDDING_DIMENSIONS     default 1024
 *   SEED_SKIP_EMBEDDINGS=1      bo qua buoc nay
 *   SEED_EMBED_WAIT_MS          default 120000 — cho AI/model san sang
 */
import { PrismaClient, ProductStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

type ObjectType = 'PRODUCT' | 'COUPON' | 'POLICY' | 'FAQ';

interface Pointer {
  objectType: ObjectType;
  objectId: string;
  text: string;
  metadata: Record<string, unknown>;
}

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForAi(baseUrl: string, totalMs: number): Promise<boolean> {
  const deadline = Date.now() + totalMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        console.log(`  AI service ready (${baseUrl}/health) after ${attempt} attempt(s)`);
        return true;
      }
    } catch {
      // retry
    }
    await sleep(2_000);
  }
  return false;
}

async function embedBatch(
  baseUrl: string,
  texts: string[],
  dimensions: number,
  timeoutMs: number,
): Promise<number[][]> {
  const res = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, task: 'retrieval.passage' }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Embedding HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    embeddings: number[][];
    dimensions: number;
  };
  if (
    data.dimensions !== dimensions ||
    data.embeddings.some((e) => e.length !== dimensions)
  ) {
    throw new Error(
      `Dimension mismatch: expected ${dimensions}, got ${data.dimensions}`,
    );
  }
  return data.embeddings;
}

function vectorLiteral(vector: number[]): string {
  if (vector.some((v) => !Number.isFinite(v))) {
    throw new Error('Embedding contains non-finite values');
  }
  return `[${vector.join(',')}]`;
}

function productPointer(product: {
  id: string;
  name: string;
  originRegion: string | null;
  variants: { id: string; price: number; unit: string }[];
}): Pointer {
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

function couponPointer(coupon: {
  id: string;
  code: string;
  name: string | null;
  type: string;
  value: number;
  minOrderValue: number;
  startsAt: Date;
  endsAt: Date;
  store: { name: string } | null;
}): Pointer {
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

function knowledgePointer(source: {
  id: string;
  code: string;
  type: string;
  title: string;
  content: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
}): Pointer {
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

/**
 * Embed seed domain objects and upsert into ai_vector_index (pgvector).
 * Does not throw on AI failure — seed domain data must still succeed.
 */
export async function seedEmbeddings(prisma: PrismaClient): Promise<void> {
  if (envBool('SEED_SKIP_EMBEDDINGS')) {
    console.log('Seeding embeddings... SKIPPED (SEED_SKIP_EMBEDDINGS=1)');
    return;
  }

  const baseUrl = (
    process.env.AI_SERVICE_URL || 'http://localhost:8000'
  ).replace(/\/$/, '');
  const dimensions = Number(process.env.AI_EMBEDDING_DIMENSIONS || '1024');
  const waitMs = Number(process.env.SEED_EMBED_WAIT_MS || '120000');
  const batchSize = Number(process.env.SEED_EMBED_BATCH_SIZE || '16');
  // First local model load can be slow
  const embedTimeoutMs = Number(process.env.SEED_EMBED_TIMEOUT_MS || '180000');

  console.log('Seeding embeddings into pgvector...');
  console.log(`  AI_SERVICE_URL=${baseUrl}`);
  console.log(`  dimensions=${dimensions}`);

  const ready = await waitForAi(baseUrl, waitMs);
  if (!ready) {
    console.warn(
      '  AI service not ready — domain seed OK, vectors NOT indexed.',
    );
    console.warn(
      '  When AI is up: POST /api/v1/ai/reindex (admin) or restart backend with AI_AUTO_REINDEX_ON_EMPTY=true.',
    );
    return;
  }

  const now = new Date();
  const [products, coupons, knowledgeSources] = await Promise.all([
    prisma.product.findMany({
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
    prisma.coupon.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { gte: now },
      },
      include: { store: { select: { name: true } } },
    }),
    prisma.knowledgeSource.findMany({
      where: {
        status: 'ACTIVE',
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
        ],
      },
    }),
  ]);

  const validCoupons = coupons.filter(
    (c) => c.usageLimit == null || c.usageCount < c.usageLimit,
  );

  const pointers: Pointer[] = [
    ...products
      .filter((p) => p.variants.length > 0)
      .map((p) => productPointer(p)),
    ...validCoupons.map((c) => couponPointer(c)),
    ...knowledgeSources.map((s) => knowledgePointer(s)),
  ];

  if (pointers.length === 0) {
    console.log('  No domain objects to embed.');
    return;
  }

  console.log(
    `  Indexing ${pointers.length} objects (products=${products.length}, coupons=${validCoupons.length}, knowledge=${knowledgeSources.length})...`,
  );

  const embeddings: number[][] = [];
  try {
    for (let i = 0; i < pointers.length; i += batchSize) {
      const slice = pointers.slice(i, i + batchSize);
      const batch = await embedBatch(
        baseUrl,
        slice.map((p) => p.text),
        dimensions,
        embedTimeoutMs,
      );
      if (batch.length !== slice.length) {
        throw new Error(
          `Batch size mismatch: sent ${slice.length}, got ${batch.length}`,
        );
      }
      embeddings.push(...batch);
      console.log(
        `  Embedded ${Math.min(i + batchSize, pointers.length)}/${pointers.length}`,
      );
    }
  } catch (e) {
    console.warn(`  Embedding failed: ${(e as Error).message}`);
    console.warn('  Domain seed OK — run POST /api/v1/ai/reindex when AI is healthy.');
    return;
  }

  // Soft-inactivate old domain vectors then upsert (same strategy as AiVectorIndexerService)
  await prisma.$executeRawUnsafe(`
    UPDATE "ai_vector_index"
    SET "status" = 'INACTIVE', "updated_at" = NOW()
    WHERE "object_type" IN ('PRODUCT', 'COUPON', 'POLICY', 'FAQ')
  `);

  for (let i = 0; i < pointers.length; i++) {
    const p = pointers[i];
    const vec = vectorLiteral(embeddings[i]);
    const metadata = JSON.stringify(p.metadata);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "ai_vector_index" (
        "id", "object_type", "object_id", "text", "embedding", "metadata", "status", "created_at", "updated_at"
      ) VALUES (
        $1, $2, $3, $4, $5::vector, $6::jsonb, 'ACTIVE', NOW(), NOW()
      )
      ON CONFLICT ("object_type", "object_id") DO UPDATE SET
        "text" = EXCLUDED."text",
        "embedding" = EXCLUDED."embedding",
        "metadata" = EXCLUDED."metadata",
        "status" = 'ACTIVE',
        "updated_at" = NOW()
      `,
      randomUUID(),
      p.objectType,
      p.objectId,
      p.text,
      vec,
      metadata,
    );
  }

  const active = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM "ai_vector_index" WHERE "status" = 'ACTIVE'`,
  );
  console.log(
    `  pgvector upsert done. ACTIVE vectors: ${active[0]?.count ?? '?'}`,
  );
}
