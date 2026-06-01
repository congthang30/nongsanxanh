import { AdminOrdersService } from './admin-orders.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

/**
 * Unit test cho AdminOrdersService.processReturn - fix P1-01.
 * Mock Prisma + Inventory + Audit. Kiem tra: duyet -> restock + Refund PENDING
 * cho don da thanh toan; tu choi -> dua ve COMPLETED; chong duyet 2 lan.
 */
describe('AdminOrdersService.processReturn (P1-01)', () => {
  let prisma: any;
  let inventory: any;
  let audit: any;
  let events: any;
  let service: AdminOrdersService;

  const baseReturn = (overrides: any = {}) => ({
    id: 'ret-1',
    status: 'REQUESTED',
    items: [
      { orderItem: { variantId: 'v1', unitPrice: 10000 }, quantity: 2 },
    ],
    order: {
      id: 'order-1',
      orderNumber: 'NS1',
      storeId: 'store-1',
      status: OrderStatus.RETURN_REQUESTED,
      payments: [
        { id: 'pay-1', status: PaymentStatus.SUCCESS, createdAt: new Date() },
      ],
    },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      returnRequest: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      order: { update: jest.fn().mockResolvedValue({}) },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      refund: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    inventory = { restockReturnedItems: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    events = { emit: jest.fn() };
    service = new AdminOrdersService(prisma, inventory, audit, events);
  });

  it('duyet (approve) don da thanh toan -> restock + Refund PENDING', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(baseReturn());
    const res = await service.processReturn('ret-1', true, 'admin-1');
    expect(res.status).toBe('RETURNED');
    expect(res.refundPending).toBe(true);
    expect(res.refundAmount).toBe(20000);
    expect(inventory.restockReturnedItems).toHaveBeenCalled();
    expect(prisma.refund.create).toHaveBeenCalled();
  });

  it('duyet don COD chua thu tien -> restock, KHONG tao Refund', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      baseReturn({
        order: {
          id: 'order-2',
          orderNumber: 'NS2',
          storeId: 'store-1',
          status: OrderStatus.RETURN_REQUESTED,
          payments: [{ id: 'p', status: PaymentStatus.PENDING, createdAt: new Date() }],
        },
      }),
    );
    const res = await service.processReturn('ret-1', true, 'admin-1');
    expect(res.status).toBe('RETURNED');
    expect(res.refundPending).toBe(false);
    expect(prisma.refund.create).not.toHaveBeenCalled();
    expect(inventory.restockReturnedItems).toHaveBeenCalled();
  });

  it('tu choi (reject) -> dua order ve COMPLETED, khong restock', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(baseReturn());
    const res = await service.processReturn('ret-1', false, 'admin-1', 'khong hop le');
    expect(res.status).toBe('REJECTED');
    expect(inventory.restockReturnedItems).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: OrderStatus.COMPLETED } }),
    );
  });

  it('return da xu ly (khong REQUESTED) -> nem loi', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(
      baseReturn({ status: 'RETURNED' }),
    );
    await expect(service.processReturn('ret-1', true, 'admin-1')).rejects.toThrow();
  });

  it('return khong ton tai -> nem loi', async () => {
    prisma.returnRequest.findUnique.mockResolvedValue(null);
    await expect(service.processReturn('x', true, 'admin-1')).rejects.toThrow();
  });
});
