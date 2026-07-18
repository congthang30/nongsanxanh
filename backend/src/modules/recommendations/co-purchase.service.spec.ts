import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CoPurchaseService } from './co-purchase.service';

describe('CoPurchaseService', () => {
  function createService() {
    const prisma = {
      order: { findMany: jest.fn() },
      productCoPurchase: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      product: { findMany: jest.fn() },
      orderItem: { groupBy: jest.fn() },
      storeInventory: { groupBy: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          productCoPurchase: {
            deleteMany: prisma.productCoPurchase.deleteMany,
            createMany: prisma.productCoPurchase.createMany,
          },
        }),
      ),
    } as unknown as PrismaService;

    return {
      service: new CoPurchaseService(prisma),
      prisma,
    };
  }

  it('rebuilds undirected pair counts from multi-item completed orders', async () => {
    const { service, prisma } = createService();
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'o1',
        items: [
          { productId: 'p2' },
          { productId: 'p1' },
          { productId: 'p1' },
        ],
      },
      {
        id: 'o2',
        items: [{ productId: 'p1' }, { productId: 'p3' }],
      },
      {
        id: 'o3',
        items: [{ productId: 'p9' }],
      },
    ]);

    const result = await service.rebuildStats();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        },
      }),
    );
    expect(result).toEqual({
      ordersScanned: 3,
      multiItemOrders: 2,
      pairs: 2,
    });
    expect(prisma.productCoPurchase.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { productIdA: 'p1', productIdB: 'p2', coCount: 1 },
        { productIdA: 'p1', productIdB: 'p3', coCount: 1 },
      ]),
    });
  });

  it('scores partners from cache without scanning orders online', async () => {
    const { service, prisma } = createService();
    (prisma.productCoPurchase.findMany as jest.Mock).mockResolvedValue([
      { productIdA: 'cart-a', productIdB: 'cand-1', coCount: 5 },
      { productIdA: 'cand-2', productIdB: 'cart-a', coCount: 3 },
    ]);
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.product.findMany as jest.Mock).mockImplementation(
      async (args: { where?: { id?: { in?: string[] } | { notIn?: string[] } } }) => {
        if (args?.where && 'id' in (args.where ?? {}) && (args.where as { id?: { in?: string[] } }).id && 'in' in ((args.where as { id: { in?: string[] } }).id ?? {})) {
          const ids = (args.where as { id: { in: string[] } }).id.in;
          return ids.map((id: string) => ({
            id,
            name: id,
            slug: id,
            images: [],
            variants: [{ id: `v-${id}`, unit: 'kg', price: 10000, status: 'ACTIVE' }],
          }));
        }
        // same-category / popular fallback product list
        return [];
      },
    );
    (prisma.storeInventory.groupBy as jest.Mock).mockResolvedValue([
      {
        variantId: 'v-cand-1',
        _sum: { quantityOnHand: 10, reservedQuantity: 0 },
      },
      {
        variantId: 'v-cand-2',
        _sum: { quantityOnHand: 4, reservedQuantity: 0 },
      },
    ]);

    const result = await service.recommendForCart(['cart-a'], 8);

    expect(prisma.productCoPurchase.findMany).toHaveBeenCalled();
    expect(result.items.map((i) => i.productId)).toEqual(['cand-1', 'cand-2']);
    expect(result.items[0].reason).toBe('CO_PURCHASE');
    expect(result.items[0].score).toBe(5);
    expect(result.source).toBe('co_purchase');
  });
});
