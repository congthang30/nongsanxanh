import { DeliveryStatus, OrderStatus } from '../../types';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Cho thanh toan',
  PLACED: 'Da dat',
  STORE_CONFIRMED: 'Cua hang da xac nhan',
  PICKING: 'Dang soan hang',
  PACKED: 'Da dong goi',
  READY_FOR_DELIVERY: 'San sang giao',
  OUT_FOR_DELIVERY: 'Dang giao',
  DELIVERED: 'Da giao',
  COMPLETED: 'Hoan tat',
  CANCELLED: 'Da huy',
  DELIVERY_FAILED: 'Giao that bai',
  RETURN_REQUESTED: 'Yeu cau tra hang',
  RETURNED: 'Da tra hang',
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  ASSIGNED: 'Da gan - cho lay hang',
  PICKED_FROM_STORE: 'Da lay hang',
  OUT_FOR_DELIVERY: 'Dang giao',
  ARRIVED_AT_CUSTOMER: 'Da den noi giao',
  DELIVERED: 'Giao thanh cong',
  FAILED: 'Giao that bai',
};

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

export function orderStatusTone(s: OrderStatus): Tone {
  if (s === 'COMPLETED' || s === 'DELIVERED') return 'success';
  if (s === 'CANCELLED' || s === 'DELIVERY_FAILED') return 'danger';
  if (s === 'OUT_FOR_DELIVERY' || s === 'READY_FOR_DELIVERY') return 'primary';
  return 'warning';
}

export function deliveryStatusTone(s: DeliveryStatus): Tone {
  if (s === 'DELIVERED') return 'success';
  if (s === 'FAILED') return 'danger';
  if (s === 'OUT_FOR_DELIVERY' || s === 'ARRIVED_AT_CUSTOMER') return 'primary';
  return 'warning';
}

/** Ly do giao that bai (theo spec muc 7.7). */
export const FAILED_REASONS = [
  'Khach khong nghe may',
  'Khach hen giao lai',
  'Sai dia chi',
  'Khach tu choi nhan',
  'Khong thu du COD',
  'Hang bi su co',
  'Khac',
] as const;
