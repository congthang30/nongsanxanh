import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AI_VECTOR_SYNC_EVENT } from '../ai/ai-vector-sync.types';
import { AiVectorIndexerService } from '../ai/ai-vector-indexer.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { CatalogService } from './catalog.service';

describe('CatalogService vector sync events', () => {
  function createService() {
    const prisma = {
      product: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as PrismaService;
    const inventory = {
      getAggregateAvailabilityMap: jest.fn(),
    } as unknown as StoreInventoryService;
    const vectorIndex = {
      relatedProductIds: jest.fn(),
    } as unknown as AiVectorIndexerService;
    const events = { emit: jest.fn() } as unknown as EventEmitter2;
    return {
      service: new CatalogService(prisma, inventory, vectorIndex, events),
      prisma,
      inventory,
      vectorIndex,
      events,
    };
  }

  it('emits a sync request after creating a product', async () => {
    const { service, prisma, events } = createService();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.product.create as jest.Mock).mockResolvedValue({
      id: 'product-1',
    });

    await service.createProduct({
      name: 'Xoai cat',
      slug: 'xoai-cat',
      categoryId: 'category-1',
      variant: { sku: 'XOAI-1', unit: 'kg', price: 65000 },
    });

    expect(events.emit).toHaveBeenCalledWith(AI_VECTOR_SYNC_EVENT, {
      objectType: 'PRODUCT',
      objectId: 'product-1',
      reason: 'created',
    });
  });

  it('emits status_changed after deactivating a product', async () => {
    const { service, prisma, events } = createService();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 'product-1',
      status: ProductStatus.ACTIVE,
    });
    (prisma.product.update as jest.Mock).mockResolvedValue({
      id: 'product-1',
      status: ProductStatus.INACTIVE,
    });

    await service.updateProduct('product-1', { status: 'INACTIVE' });

    expect(events.emit).toHaveBeenCalledWith(AI_VECTOR_SYNC_EVENT, {
      objectType: 'PRODUCT',
      objectId: 'product-1',
      reason: 'status_changed',
    });
  });

  it('uses vector hits and filters related products through business rules', async () => {
    const { service, prisma, inventory, vectorIndex } = createService();
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'source-1' });
    (vectorIndex.relatedProductIds as jest.Mock).mockResolvedValue([
      { objectId: 'product-2', score: 0.91 },
      { objectId: 'product-3', score: 0.88 },
    ]);
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'product-3',
        name: 'Buoi da xanh',
        slug: 'buoi-da-xanh',
        ratingAvg: 4.6,
        images: [{ url: '/buoi.jpg' }],
        variants: [{ id: 'variant-3', price: 72000, unit: 'kg' }],
      },
      {
        id: 'product-2',
        name: 'Xoai cat',
        slug: 'xoai-cat',
        ratingAvg: 4.8,
        images: [{ url: '/xoai.jpg' }],
        variants: [{ id: 'variant-2', price: 65000, unit: 'kg' }],
      },
    ]);
    (inventory.getAggregateAvailabilityMap as jest.Mock).mockResolvedValue(
      new Map([
        ['variant-2', 12],
        ['variant-3', 0],
      ]),
    );

    const related = await service.relatedProducts('source-slug');

    expect(vectorIndex.relatedProductIds).toHaveBeenCalledWith('source-1', 24);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['product-2', 'product-3'] },
          status: ProductStatus.ACTIVE,
          deletedAt: null,
          variants: { some: { status: 'ACTIVE' } },
        }),
      }),
    );
    expect(related).toEqual([
      {
        id: 'product-2',
        name: 'Xoai cat',
        slug: 'xoai-cat',
        ratingAvg: 4.8,
        image: '/xoai.jpg',
        fromPrice: 65000,
        unit: 'kg',
      },
    ]);
  });
});
