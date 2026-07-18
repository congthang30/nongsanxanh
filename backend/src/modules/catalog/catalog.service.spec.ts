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
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      id: 'source-1',
      categoryId: 'cat-1',
    });
    (vectorIndex.relatedProductIds as jest.Mock).mockResolvedValue([
      { objectId: 'product-2', score: 0.91 },
      { objectId: 'product-3', score: 0.88 },
    ]);
    (prisma.product.findMany as jest.Mock).mockImplementation(async (args: {
      select?: { id?: boolean };
      where?: { id?: { in?: string[] }; categoryId?: string };
    }) => {
      // Category candidate query (select id only)
      if (args?.select?.id) {
        return [{ id: 'product-4' }, { id: 'product-2' }];
      }
      // Detail hydrate
      return [
        {
          id: 'product-3',
          categoryId: 'cat-1',
          name: 'Buoi da xanh',
          slug: 'buoi-da-xanh',
          ratingAvg: 4.6,
          images: [{ url: '/buoi.jpg' }],
          variants: [{ id: 'variant-3', price: 72000, unit: 'kg' }],
        },
        {
          id: 'product-2',
          categoryId: 'cat-2',
          name: 'Xoai cat',
          slug: 'xoai-cat',
          ratingAvg: 4.8,
          images: [{ url: '/xoai.jpg' }],
          variants: [{ id: 'variant-2', price: 65000, unit: 'kg' }],
        },
        {
          id: 'product-4',
          categoryId: 'cat-1',
          name: 'Cam sanh',
          slug: 'cam-sanh',
          ratingAvg: 4.2,
          images: [{ url: '/cam.jpg' }],
          variants: [{ id: 'variant-4', price: 40000, unit: 'kg' }],
        },
      ];
    });
    (inventory.getAggregateAvailabilityMap as jest.Mock).mockResolvedValue(
      new Map([
        ['variant-2', 12],
        ['variant-3', 0],
        ['variant-4', 5],
      ]),
    );

    const related = await service.relatedProducts('source-slug');

    expect(vectorIndex.relatedProductIds).toHaveBeenCalledWith('source-1', 24);
    // product-3 het hang (embedding) bi loai; product-2 embedding con hang; product-4 category
    expect(related).toEqual({
      byEmbedding: [
        {
          id: 'product-2',
          name: 'Xoai cat',
          slug: 'xoai-cat',
          ratingAvg: 4.8,
          image: '/xoai.jpg',
          fromPrice: 65000,
          unit: 'kg',
        },
      ],
      byCategory: [
        {
          id: 'product-4',
          name: 'Cam sanh',
          slug: 'cam-sanh',
          ratingAvg: 4.2,
          image: '/cam.jpg',
          fromPrice: 40000,
          unit: 'kg',
        },
      ],
      preview: [
        {
          id: 'product-2',
          name: 'Xoai cat',
          slug: 'xoai-cat',
          ratingAvg: 4.8,
          image: '/xoai.jpg',
          fromPrice: 65000,
          unit: 'kg',
        },
        {
          id: 'product-4',
          name: 'Cam sanh',
          slug: 'cam-sanh',
          ratingAvg: 4.2,
          image: '/cam.jpg',
          fromPrice: 40000,
          unit: 'kg',
        },
      ],
    });
  });
});
