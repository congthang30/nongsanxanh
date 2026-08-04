import { CampaignStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService scheduled pricing', () => {
  function createService() {
    const prisma = {
      campaign: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      campaignItem: { findMany: jest.fn() },
      productVariant: { findMany: jest.fn() },
      $executeRaw: jest.fn(),
      $transaction: jest.fn((callback) => callback(prisma)),
    } as unknown as PrismaService;
    return { service: new CampaignsService(prisma), prisma };
  }

  it('looks up scheduled campaigns only inside [startsAt, endsAt)', async () => {
    const { service, prisma } = createService();
    (prisma.campaignItem.findMany as jest.Mock).mockResolvedValue([
      {
        variantId: 'variant-1',
        salePrice: 120000,
        quantityLimit: null,
        soldCount: 0,
      },
    ]);

    const prices = await service.getActiveSalePrices(['variant-1']);

    expect(prices.get('variant-1')).toBe(120000);
    expect(prisma.campaignItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          batchId: null,
          campaign: expect.objectContaining({
            status: { in: [CampaignStatus.SCHEDULED, CampaignStatus.ACTIVE] },
            startsAt: { lte: expect.any(Date) },
            endsAt: { gt: expect.any(Date) },
          }),
        }),
      }),
    );
  });

  it('rejects overlapping schedules for the same variant', async () => {
    const { service, prisma } = createService();
    (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([
      { id: 'variant-1', price: 150000 },
    ]);
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({ name: 'Giá buổi sáng' });

    await expect(
      service.createCampaign({
        name: 'Giá buổi trưa',
        slug: 'gia-buoi-trua',
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        items: [{ variantId: 'variant-1', salePrice: 120000 }],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CAMPAIGN_TIME_OVERLAP' }),
    });
  });
});
