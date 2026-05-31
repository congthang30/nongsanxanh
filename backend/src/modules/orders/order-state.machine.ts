import { OrderStatus } from '@prisma/client';

/**
 * State machine cho don hang trong mo hinh chuoi cua hang.
 * Vong doi: PENDING_PAYMENT -> PLACED -> STORE_CONFIRMED -> PICKING -> PACKED
 *   -> READY_FOR_DELIVERY -> OUT_FOR_DELIVERY -> DELIVERED -> COMPLETED
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [
    OrderStatus.PLACED,
    OrderStatus.CANCELLED,
  ],
  PLACED: [
    OrderStatus.STORE_CONFIRMED,
    OrderStatus.CANCELLED,
  ],
  STORE_CONFIRMED: [
    OrderStatus.PICKING,
    OrderStatus.CANCELLED,
  ],
  PICKING: [
    OrderStatus.PACKED,
    OrderStatus.CANCELLED,
  ],
  PACKED: [
    OrderStatus.READY_FOR_DELIVERY,
    OrderStatus.CANCELLED,
  ],
  READY_FOR_DELIVERY: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.CANCELLED,
  ],
  OUT_FOR_DELIVERY: [
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERY_FAILED,
  ],
  DELIVERED: [
    OrderStatus.COMPLETED,
    OrderStatus.RETURN_REQUESTED,
  ],
  COMPLETED: [
    OrderStatus.RETURN_REQUESTED,
  ],
  DELIVERY_FAILED: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.CANCELLED,
    OrderStatus.RETURNED,
  ],
  CANCELLED: [],
  RETURN_REQUESTED: [
    OrderStatus.RETURNED,
    OrderStatus.COMPLETED,
  ],
  RETURNED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Trang thai cho phep khach huy don (truoc khi soan hang). */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PLACED,
  OrderStatus.STORE_CONFIRMED,
];

/** Trang thai van con giu reserved inventory (chua commit, chua release). */
export const RESERVED_STATUSES: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.STORE_CONFIRMED,
  OrderStatus.PICKING,
  OrderStatus.PACKED,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
];
