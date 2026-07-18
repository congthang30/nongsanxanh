import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiHttpService } from './ai-http.service';
import { AiService } from './ai.service';
import { ChatMemoryStore } from './chat-memory.store';
import { AiVectorIndexerService } from './ai-vector-indexer.service';

describe('AiService', () => {
  const config = {
    get: (_key: string, fallback: string) => fallback,
  } as ConfigService;

  function createService(prismaOverrides: Record<string, unknown> = {}) {
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue([]) },
      storeInventory: { aggregate: jest.fn() },
      coupon: { findMany: jest.fn().mockResolvedValue([]) },
      knowledgeSource: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      ...prismaOverrides,
    } as unknown as PrismaService;
    const ai = {
      embed: jest.fn().mockResolvedValue([]),
      generate: jest.fn().mockResolvedValue(null),
    } as unknown as AiHttpService;
    const memory = {
      getOrCreate: jest.fn().mockResolvedValue('conversation-1'),
      append: jest.fn().mockResolvedValue(undefined),
      history: jest.fn(),
    } as unknown as ChatMemoryStore;
    const indexer = {
      reindexDomainObjects: jest.fn(),
      relatedProductIds: jest.fn().mockResolvedValue([]),
    } as unknown as AiVectorIndexerService;
    return {
      service: new AiService(prisma, ai, memory, indexer, config),
      prisma,
      ai,
      memory,
      indexer,
    };
  }

  it('suggests similar products via related embeddings instead of listing catalog', async () => {
    const products = [
      {
        id: 'nuoc-mam-id',
        name: 'Nuoc mam Phu Quoc 500ml',
        originRegion: 'Phu Quoc',
        variants: [
          { id: 'v-mam', price: 52000, unit: 'chai', status: 'ACTIVE' },
        ],
      },
      {
        id: 'gao-id',
        name: 'Gao ST25 thuong hang',
        originRegion: 'Soc Trang',
        variants: [
          { id: 'v-gao', price: 38000, unit: 'tui 5kg', status: 'ACTIVE' },
        ],
      },
      {
        id: 'tuong-id',
        name: 'Tuong ot Chin-Su',
        originRegion: 'Viet Nam',
        variants: [
          { id: 'v-tuong', price: 25000, unit: 'chai', status: 'ACTIVE' },
        ],
      },
    ];
    const { service, ai, indexer } = createService({
      product: { findMany: jest.fn().mockResolvedValue(products) },
      storeInventory: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { quantityOnHand: 50, reservedQuantity: 0 },
        }),
      },
    });
    (indexer.relatedProductIds as jest.Mock).mockResolvedValue([
      { objectId: 'tuong-id', score: 0.8 },
      { objectId: 'gao-id', score: 0.5 },
    ]);

    const result = await service.chat({
      message: 'San pham nao giong nuoc mam Phu Quoc?',
      sessionId: 'session-similar',
    });

    expect(indexer.relatedProductIds).toHaveBeenCalledWith('nuoc-mam-id', 12);
    expect(result.answer).toContain('Tuong ot Chin-Su');
    expect(result.answer).toMatch(/tương đồng|liên quan|embedding/i);
    expect(result.answer).not.toMatch(/dang co 3 san pham/i);
    expect(ai.generate).not.toHaveBeenCalled();
  });

  it('answers product price from domain tables without calling AI', async () => {
    const { service, ai } = createService({
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'product-1',
            name: 'Xoai cat Hoa Loc',
            originRegion: 'Tien Giang',
            variants: [
              { id: 'variant-1', price: 65000, unit: 'kg', status: 'ACTIVE' },
            ],
          },
        ]),
      },
      storeInventory: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { quantityOnHand: 20, reservedQuantity: 2 },
        }),
      },
    });

    const result = await service.chat({
      message: 'Gia xoai bao nhieu?',
      sessionId: 'session-one',
    });

    expect(result.answer).toContain('65.000');
    expect(ai.embed).not.toHaveBeenCalled();
    expect(ai.generate).not.toHaveBeenCalled();
  });

  it('uses a vector pointer then validates coupon data in Postgres', async () => {
    const coupon = {
      id: 'coupon-1',
      code: 'JULY20',
      name: 'Khuyen mai 20/7',
      type: 'PERCENT',
      value: 20,
      minOrderValue: 100000,
      startsAt: new Date('2026-07-20T00:00:00.000Z'),
      endsAt: new Date('2026-07-20T23:59:59.000Z'),
      usageLimit: 100,
      usageCount: 0,
      store: null,
    };
    const { service, prisma, ai } = createService({
      coupon: { findMany: jest.fn().mockResolvedValue([coupon]) },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          objectType: 'COUPON',
          objectId: coupon.id,
          text: 'Khuyen mai ngay 20/7',
          metadata: null,
          score: 0.9,
        },
      ]),
    });
    (ai.embed as jest.Mock).mockResolvedValue([[0.1, 0.2]]);

    const result = await service.chat({
      message: 'Ngay 20/7/2026 co khuyen mai gi?',
      sessionId: 'session-one',
    });

    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [coupon.id] } }),
      }),
    );
    expect(result.answer).toContain('JULY20');
    expect(result.cards).toEqual([
      expect.objectContaining({ type: 'coupon', id: coupon.id, code: 'JULY20' }),
    ]);
  });
});
