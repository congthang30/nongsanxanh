import { DeliveryStatus, OrderStatus } from '@prisma/client';
import { ShipperService } from './shipper.service';

describe('ShipperService job visibility', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const service = new ShipperService(
    { delivery: { findMany } } as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => findMany.mockClear());

  it('chi hien thi don active sau khi kho dong goi xong', async () => {
    await service.listJobs('shipper-1', 'active');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shipperId: 'shipper-1',
          OR: [
            {
              status: {
                in: [
                  DeliveryStatus.ASSIGNED,
                  DeliveryStatus.PICKED_FROM_STORE,
                ],
              },
              order: { status: OrderStatus.READY_FOR_DELIVERY },
            },
            {
              status: {
                in: [
                  DeliveryStatus.OUT_FOR_DELIVERY,
                  DeliveryStatus.ARRIVED_AT_CUSTOMER,
                ],
              },
              order: { status: OrderStatus.OUT_FOR_DELIVERY },
            },
          ],
        },
      }),
    );
  });

  it('khong dua don bi huy truoc khi giao vao lich su shipper', async () => {
    await service.listJobs('shipper-1', 'history');

    const query = findMany.mock.calls[0][0];
    const failedJob = query.where.OR[1];
    expect(failedJob).toEqual(
      expect.objectContaining({
        status: DeliveryStatus.FAILED,
        events: { some: { status: DeliveryStatus.FAILED } },
      }),
    );
  });
});
