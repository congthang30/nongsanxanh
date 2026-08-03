import { DeliveryStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { FulfillmentService } from './fulfillment.service';

describe('FulfillmentService warehouse flow', () => {
  const user = {
    id: 'warehouse-1',
    roles: ['WAREHOUSE_STAFF'],
    permissions: [],
    sessionId: 'session-1',
  };
  let prisma: any;
  let inventory: any;
  let scope: any;
  let audit: any;
  let events: any;
  let service: FulfillmentService;

  beforeEach(() => {
    prisma = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      delivery: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      refund: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
    };
    inventory = { releaseForOrder: jest.fn().mockResolvedValue(undefined) };
    scope = {
      requireUserStoreId: jest.fn().mockResolvedValue('store-1'),
      getOrderInScope: jest.fn().mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PLACED,
        storeId: 'store-1',
        grandTotal: 150000,
        items: [{ id: 'item-1', quantity: 2 }],
      }),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    events = { emit: jest.fn() };
    service = new FulfillmentService(prisma, inventory, scope, audit, events);
  });

  it('liet ke lich su don kho theo dung chi nhanh va khong tron don dang xu ly', async () => {
    await service.listProcessedWarehouseOrders(user);

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        storeId: 'store-1',
        status: {
          in: [
            OrderStatus.PACKED,
            OrderStatus.READY_FOR_DELIVERY,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
            OrderStatus.COMPLETED,
            OrderStatus.CANCELLED,
            OrderStatus.DELIVERY_FAILED,
            OrderStatus.RETURN_REQUESTED,
            OrderStatus.RETURNED,
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: true,
        user: { include: { profile: true } },
      },
      take: 200,
    });
  });

  it('xac nhan va bat dau soan atomically: PLACED -> STORE_CONFIRMED -> PICKING', async () => {
    await service.confirmAndStartPicking(user, 'order-1');

    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'order-1', status: OrderStatus.PLACED },
      data: { status: OrderStatus.STORE_CONFIRMED },
    });
    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'order-1', status: OrderStatus.STORE_CONFIRMED },
      data: { status: OrderStatus.PICKING },
    });
    expect(inventory.releaseForOrder).not.toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith('order.status_changed', {
      orderId: 'order-1',
      status: OrderStatus.PICKING,
    });
  });

  it('dong goi va tu dong ban giao shipper trong cung transaction', async () => {
    scope.getOrderInScope.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PICKING,
      storeId: 'store-1',
      items: [{ id: 'item-1', quantity: 2 }],
    });

    await service.markPacked(user, 'order-1');

    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'order-1', status: OrderStatus.PICKING },
      data: { status: OrderStatus.PACKED },
    });
    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'order-1', status: OrderStatus.PACKED },
      data: { status: OrderStatus.READY_FOR_DELIVERY },
    });
    expect(prisma.orderStatusHistory.create).toHaveBeenNthCalledWith(2, {
      data: {
        orderId: 'order-1',
        fromStatus: OrderStatus.PACKED,
        toStatus: OrderStatus.READY_FOR_DELIVERY,
        actorId: user.id,
        reason: 'Kho da dong goi, san sang giao shipper',
      },
    });
    expect(events.emit).toHaveBeenCalledWith('order.packed', { orderId: 'order-1' });
  });

  it('bao thieu COD: huy don, nha ton, huy payment/delivery va bat buoc audit ly do', async () => {
    await service.reportShortage(user, 'order-1', '  Thiếu 2 kg cà chua  ');

    expect(inventory.releaseForOrder).toHaveBeenCalledWith(
      prisma,
      'order-1',
      user.id,
    );
    expect(prisma.delivery.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: DeliveryStatus.ASSIGNED },
      data: {
        status: DeliveryStatus.FAILED,
        failureReason: 'Thiếu 2 kg cà chua',
      },
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: 'order-1',
        status: { in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
      },
      data: { status: PaymentStatus.CANCELLED },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { paymentStatus: PaymentStatus.CANCELLED },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'ORDER_SHORTAGE_REPORTED',
        actorId: user.id,
        metadata: expect.objectContaining({
          reason: 'Thiếu 2 kg cà chua',
          refundPending: false,
        }),
      }),
    });
  });

  it('bao thieu don VNPay da tra: tao Refund PENDING trong cung transaction', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'payment-1' });

    await service.reportShortage(user, 'order-1', 'Hết xoài loại 1');

    expect(prisma.refund.create).toHaveBeenCalledWith({
      data: {
        paymentId: 'payment-1',
        orderId: 'order-1',
        amount: 150000,
        status: 'PENDING',
        reason: 'Hết xoài loại 1',
      },
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PaymentStatus.REFUND_PENDING },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { paymentStatus: PaymentStatus.REFUND_PENDING },
    });
    expect(events.emit).toHaveBeenCalledWith(
      'order.cancelled',
      expect.objectContaining({ refundPending: true }),
    );
  });

  it('tu choi ly do thieu hang rong truoc khi sua du lieu', async () => {
    await expect(service.reportShortage(user, 'order-1', '  ')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REASON_REQUIRED' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
