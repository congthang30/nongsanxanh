import { StoreInventoryService } from './inventory.service';

const batch = (id: string, expiryDate: string, price = 150000) => ({
  id,
  variantId: 'variant-1',
  batchCode: id,
  expiryDate: new Date(expiryDate),
  receivedDate: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  quantityOnHand: 10,
  reservedQuantity: 0,
  variant: { price },
});

const makeService = (
  batches: ReturnType<typeof batch>[],
  salePrices: Map<string, number>,
  storePrice: number | null = 140000,
) => {
  const prisma = {
    inventoryBatch: { findMany: jest.fn().mockResolvedValue(batches) },
    storeInventory: {
      findMany: jest.fn().mockResolvedValue([
        { variantId: 'variant-1', salePrice: null, priceOverride: storePrice },
      ]),
    },
  };
  const campaigns = {
    getActiveSalePrices: jest.fn().mockResolvedValue(salePrices),
  };
  return new StoreInventoryService(prisma as any, campaigns as any);
};

describe('StoreInventoryService scheduled batch prices', () => {
  it('prioritizes an active variant campaign over store and base prices', async () => {
    const service = makeService(
      [batch('batch-1', '2026-12-01')],
      new Map([['variant-1', 120000]]),
    );

    const prices = await service.getStorePrices('store-1', ['variant-1']);

    expect(prices.get('variant-1')).toBe(120000);
  });

  it('falls back to the existing store price outside campaign windows', async () => {
    const service = makeService([batch('batch-1', '2026-12-01')], new Map());

    const prices = await service.getStorePrices('store-1', ['variant-1']);

    expect(prices.get('variant-1')).toBe(140000);
  });

  it('keeps a targeted campaign price isolated to its inventory batch', async () => {
    const service = makeService(
      [batch('batch-1', '2026-12-01'), batch('batch-2', '2026-12-02')],
      new Map([['variant-1:batch-2', 50000]]),
    );

    const options = await service.getBatchOptions('store-1', ['variant-1']);

    expect(options.map((option) => [option.id, option.unitPrice])).toEqual([
      ['batch-1', 140000],
      ['batch-2', 50000],
    ]);
  });
});
