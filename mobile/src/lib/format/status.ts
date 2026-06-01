import { DeliveryStatus, OrderStatus } from '../../types';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PLACED: 'Đã đặt hàng',
  STORE_CONFIRMED: 'Cửa hàng đã xác nhận',
  PICKING: 'Đang soạn hàng',
  PACKED: 'Đã đóng gói',
  READY_FOR_DELIVERY: 'Sẵn sàng giao',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  DELIVERY_FAILED: 'Giao thất bại',
  RETURN_REQUESTED: 'Đang yêu cầu trả hàng',
  RETURNED: 'Đã trả hàng',
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  ASSIGNED: 'Đã gán',
  PICKED_FROM_STORE: 'Đã lấy hàng',
  OUT_FOR_DELIVERY: 'Đang giao',
  ARRIVED_AT_CUSTOMER: 'Đã đến nơi',
  DELIVERED: 'Đã giao',
  FAILED: 'Giao thất bại',
};

/** Payment status. Backend tra ve chuoi enum; map sang nhan tieng Viet. */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  INITIATED: 'Đã khởi tạo',
  PENDING: 'Đang chờ',
  SUCCESS: 'Đã thanh toán',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
};

export function paymentStatusLabel(status?: string | null): string {
  if (!status) return '—';
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

export function orderStatusTone(s: OrderStatus): Tone {
  if (s === 'COMPLETED' || s === 'DELIVERED') return 'success';
  if (s === 'CANCELLED' || s === 'DELIVERY_FAILED' || s === 'RETURNED') return 'danger';
  if (s === 'OUT_FOR_DELIVERY' || s === 'READY_FOR_DELIVERY') return 'primary';
  return 'warning';
}

export function deliveryStatusTone(s: DeliveryStatus): Tone {
  if (s === 'DELIVERED') return 'success';
  if (s === 'FAILED') return 'danger';
  if (s === 'OUT_FOR_DELIVERY' || s === 'ARRIVED_AT_CUSTOMER') return 'primary';
  return 'warning';
}

export function paymentStatusTone(status?: string | null): Tone {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'REFUNDED') return 'neutral';
  return 'warning';
}

/** Ly do giao that bai goi y (theo spec muc 9.4). */
export const FAILED_REASONS = [
  'Khách không nghe máy',
  'Sai địa chỉ',
  'Khách hẹn giao lại',
  'Khách từ chối nhận',
  'Không thu được COD',
  'Hàng bị sự cố',
  'Khác',
] as const;
