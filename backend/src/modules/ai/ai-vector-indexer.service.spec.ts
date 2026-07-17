import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiHttpService } from './ai-http.service';
import { AiVectorIndexerService } from './ai-vector-indexer.service';

describe('AiVectorIndexerService', () => {
  function createService() {
    const prisma = {
      product: { findUnique: jest.fn() },
      coupon: { findUnique: jest.fn() },
      knowledgeSource: { findUnique: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
    } as unknown as PrismaService;
    const ai = {
      embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    } as unknown as AiHttpService;
    return {
      service: new AiVectorIndexerService(prisma, ai),
      prisma,
      ai,
    };
  }

  it('embeds and upserts the latest active product state', async () => {
    const { service, prisma, ai } = createService();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 'product-1',
      name: 'Xoai cat',
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      originRegion: 'Tien Giang',
      variants: [{ id: 'variant-1', price: 65000, unit: 'kg' }],
    });

    const result = await service.syncObject('PRODUCT', 'product-1');

    expect(ai.embed).toHaveBeenCalledWith(
      [expect.stringContaining('Xoai cat')],
      'retrieval.passage',
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ACTIVE');
  });

  it('marks a missing product pointer inactive without embedding', async () => {
    const { service, prisma, ai } = createService();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await service.syncObject('PRODUCT', 'missing');

    expect(ai.embed).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('INACTIVE');
  });

  it('keeps the old pointer untouched when embedding fails', async () => {
    const { service, prisma, ai } = createService();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 'product-1',
      name: 'Xoai cat',
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      originRegion: null,
      variants: [{ id: 'variant-1', price: 65000, unit: 'kg' }],
    });
    (ai.embed as jest.Mock).mockRejectedValue(new Error('AI unavailable'));

    await expect(service.syncObject('PRODUCT', 'product-1')).rejects.toThrow(
      'AI unavailable',
    );
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('marks an exhausted coupon inactive', async () => {
    const { service, prisma, ai } = createService();
    (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      id: 'coupon-1',
      status: 'ACTIVE',
      endsAt: new Date(Date.now() + 60_000),
      usageLimit: 5,
      usageCount: 5,
      store: null,
    });

    const result = await service.syncObject('COUPON', 'coupon-1');

    expect(ai.embed).not.toHaveBeenCalled();
    expect(result.status).toBe('INACTIVE');
  });
});
