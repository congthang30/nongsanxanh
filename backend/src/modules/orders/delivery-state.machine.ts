import { DeliveryStatus } from '@prisma/client';

/**
 * State machine cho phien giao hang (Delivery).
 * MVP khong co offer/accept/reject. Shipper chinh cua store duoc gan truc tiep.
 *
 * ASSIGNED -> PICKED_FROM_STORE -> OUT_FOR_DELIVERY -> ARRIVED_AT_CUSTOMER
 *   -> DELIVERED | FAILED
 */
export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  ASSIGNED: [DeliveryStatus.PICKED_FROM_STORE],
  PICKED_FROM_STORE: [DeliveryStatus.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [
    DeliveryStatus.ARRIVED_AT_CUSTOMER,
    DeliveryStatus.DELIVERED,
    DeliveryStatus.FAILED,
  ],
  ARRIVED_AT_CUSTOMER: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  DELIVERED: [],
  FAILED: [],
};

export function canDeliveryTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
): boolean {
  return DELIVERY_TRANSITIONS[from]?.includes(to) ?? false;
}
