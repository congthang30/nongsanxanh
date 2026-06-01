import { PaymentService } from './payment.service';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

/**
 * Unit test cho PaymentService.handleVnpayCallback - cac fix tien P0/P1.
 * Mock Prisma + Vnpay + Orders + Audit, khong can DB that.
 */
describe('PaymentService.handleVnpayCallback', () => {
  let prisma: any;
  let orders: any;
  let vnpay: any;
  let audit: any;
  let service: PaymentService;

  const baseOrder = {
    id: 'order-1',
    orderNumber: 'NS12345678',
    grandTotal: 100000,
    status: OrderStatus.PLACED,
    paymentStatus: PaymentStatus.PENDING,
    storeId: 'store-1',
    payments: [{ id: 'pay-1', method: 'VNPAY', status: PaymentStatus.PENDING }],
  };

  const goodQuery = () => ({
    vnp_TxnRef: 'NS12345678',
    vnp_ResponseCode: '00',
    vnp_TransactionNo: 'TXN1',
    vnp_Amount: String(100000 * 100),
    vnp_SecureHash: 'sig',
  });

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ ...baseOrder }),
        update: jest.fn().mockResolvedValue({}),
      },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-new' }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      paymentTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      refund: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    orders = {
      markPaid: jest.fn().mockResolvedValue(undefined),
      markPaymentFailed: jest.fn().mockResolvedValue(undefined),
    };
    vnpay = { verifySignature: jest.fn().mockReturnValue(true) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentService(prisma, orders, vnpay, audit);
  });

  it('chu ky sai -> nem loi, khong xu ly', async () => {
    vnpay.verifySignature.mockReturnValue(false);
    await expect(service.handleVnpayCallback(goodQuery())).rejects.toThrow();
    expect(orders.markPaid).not.toHaveBeenCalled();
  });

  it('P0-01: amount mismatch -> KHONG markPaid, ghi audit AMOUNT_MISMATCH', async () => {
    const q = goodQuery();
    q.vnp_Amount = '1'; // sai so tien
    const res = await service.handleVnpayCallback(q);
    expect(res.amountMismatch).toBe(true);
    expect(res.success).toBe(false);
    expect(orders.markPaid).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYMENT_AMOUNT_MISMATCH' }),
    );
  });

  it('P0-07: callback da xu ly truoc do -> tra idempotent, khong markPaid lai', async () => {
    prisma.paymentTransaction.findUnique.mockResolvedValue({ id: 'txn-old' });
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      paymentStatus: PaymentStatus.SUCCESS,
    });
    const res = await service.handleVnpayCallback(goodQuery());
    expect(res.idempotent).toBe(true);
    expect(orders.markPaid).not.toHaveBeenCalled();
  });

  it('P0-07: unique violation khi tao transaction -> coi nhu idempotent', async () => {
    prisma.paymentTransaction.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '6',
      }),
    );
    const res = await service.handleVnpayCallback(goodQuery());
    expect(res.idempotent).toBe(true);
    expect(orders.markPaid).not.toHaveBeenCalled();
  });

  it('P1-01: don da CANCELLED nhung tra thanh cong -> tao Refund, khong markPaid', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      status: OrderStatus.CANCELLED,
    });
    const res = await service.handleVnpayCallback(goodQuery());
    expect(res.refundPending).toBe(true);
    expect(prisma.refund.create).toHaveBeenCalled();
    expect(orders.markPaid).not.toHaveBeenCalled();
  });

  it('thanh cong binh thuong -> markPaid + payment SUCCESS', async () => {
    const res = await service.handleVnpayCallback(goodQuery());
    expect(res.success).toBe(true);
    expect(orders.markPaid).toHaveBeenCalledWith('order-1');
  });

  it('that bai (code != 00) -> markPaymentFailed', async () => {
    const q = goodQuery();
    q.vnp_ResponseCode = '24';
    const res = await service.handleVnpayCallback(q);
    expect(res.success).toBe(false);
    expect(orders.markPaymentFailed).toHaveBeenCalledWith('order-1');
  });

  it('P2-12: payload luu vao transaction da strip vnp_SecureHash', async () => {
    await service.handleVnpayCallback(goodQuery());
    const createArg = prisma.paymentTransaction.create.mock.calls[0][0];
    expect(createArg.data.callbackPayload.vnp_SecureHash).toBeUndefined();
  });
});
