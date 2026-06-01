import { POSReturnService } from './pos-return.service';
import { POSReturnStatus, POSSaleStatus } from '@prisma/client';

/**
 * Unit test cho POSReturnService.createReturn - fix P0-06 (cong don so luong tra).
 * Dam bao khong cho tra vuot so luong da ban tinh ca cac lan tra truoc.
 */
describe('POSReturnService.createReturn (P0-06)', () => {
  let prisma: any;
  let inventory: any;
  let scope: any;
  let audit: any;
  let service: POSReturnService;

  const sale = {
    id: 'sale-1',
    saleNumber: 'POS123',
    storeId: 'store-1',
    status: POSSaleStatus.PAID,
    items: [
      { id: 'si-1', unitPrice: 10000, quantity: 5, productNameSnapshot: 'Tao' },
    ],
  };

  beforeEach(() => {
    prisma = {
      pOSSale: { findUnique: jest.fn().mockResolvedValue(sale) },
      pOSReturnItem: { findMany: jest.fn().mockResolvedValue([]) },
      pOSReturn: {
        create: jest.fn().mockResolvedValue({ id: 'ret-1', items: [] }),
      },
    };
    inventory = {};
    scope = { assertStoreAccess: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new POSReturnService(prisma, inventory, scope, audit);
  });

  it('tra trong gioi han -> thanh cong', async () => {
    const res = await service.createReturn({ id: 'u1', roles: [] } as any, {
      saleId: 'sale-1',
      reason: 'loi',
      items: [{ saleItemId: 'si-1', quantity: 3 }],
    } as any);
    expect(res).toBeDefined();
    expect(prisma.pOSReturn.create).toHaveBeenCalled();
  });

  it('da tra 3 truoc do, tra them 3 (tong 6 > 5) -> INVALID_RETURN_QTY', async () => {
    prisma.pOSReturnItem.findMany.mockResolvedValue([
      { saleItemId: 'si-1', quantity: 3 },
    ]);
    await expect(
      service.createReturn({ id: 'u1', roles: [] } as any, {
        saleId: 'sale-1',
        reason: 'loi',
        items: [{ saleItemId: 'si-1', quantity: 3 }],
      } as any),
    ).rejects.toThrow();
  });

  it('da tra 3 truoc do, tra them 2 (tong 5 = 5) -> thanh cong', async () => {
    prisma.pOSReturnItem.findMany.mockResolvedValue([
      { saleItemId: 'si-1', quantity: 3 },
    ]);
    const res = await service.createReturn({ id: 'u1', roles: [] } as any, {
      saleId: 'sale-1',
      reason: 'loi',
      items: [{ saleItemId: 'si-1', quantity: 2 }],
    } as any);
    expect(res).toBeDefined();
  });

  it('tra vuot so luong ban ngay lan dau -> INVALID_RETURN_QTY', async () => {
    await expect(
      service.createReturn({ id: 'u1', roles: [] } as any, {
        saleId: 'sale-1',
        reason: 'loi',
        items: [{ saleItemId: 'si-1', quantity: 6 }],
      } as any),
    ).rejects.toThrow();
  });
});
