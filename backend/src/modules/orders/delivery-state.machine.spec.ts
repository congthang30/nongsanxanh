import { DeliveryStatus } from '@prisma/client';
import { canDeliveryTransition } from './delivery-state.machine';

describe('delivery state machine', () => {
  it('bat buoc den noi giao truoc khi thanh cong hoac that bai', () => {
    expect(
      canDeliveryTransition(
        DeliveryStatus.OUT_FOR_DELIVERY,
        DeliveryStatus.ARRIVED_AT_CUSTOMER,
      ),
    ).toBe(true);
    expect(
      canDeliveryTransition(
        DeliveryStatus.OUT_FOR_DELIVERY,
        DeliveryStatus.DELIVERED,
      ),
    ).toBe(false);
    expect(
      canDeliveryTransition(
        DeliveryStatus.OUT_FOR_DELIVERY,
        DeliveryStatus.FAILED,
      ),
    ).toBe(false);
    expect(
      canDeliveryTransition(
        DeliveryStatus.ARRIVED_AT_CUSTOMER,
        DeliveryStatus.DELIVERED,
      ),
    ).toBe(true);
    expect(
      canDeliveryTransition(
        DeliveryStatus.ARRIVED_AT_CUSTOMER,
        DeliveryStatus.FAILED,
      ),
    ).toBe(true);
  });
});
