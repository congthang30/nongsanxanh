export const formatVnd = (n: number): string =>
  new Intl.NumberFormat('vi-VN').format(n) + '\u0111';

/** Định dạng ngày giờ tiếng Việt ngắn gọn. */
export const formatDateTime = (value: string | number | Date): string =>
  new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PLACED: 'Đã đặt hàng',
  STORE_CONFIRMED: 'Cửa hàng đã xác nhận',
  PICKING: 'Đang soạn hàng',
  PACKED: 'Đã đóng gói',
  READY_FOR_DELIVERY: 'Sẵn sàng giao',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  DELIVERY_FAILED: 'Giao thất bại',
  RETURN_REQUESTED: 'Yêu cầu trả hàng',
  RETURNED: 'Đã trả hàng',
};

export const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING_PAYMENT: 'badge-amber',
  PLACED: 'badge-blue',
  STORE_CONFIRMED: 'badge-blue',
  PICKING: 'badge-amber',
  PACKED: 'badge-amber',
  READY_FOR_DELIVERY: 'badge-amber',
  OUT_FOR_DELIVERY: 'badge-blue',
  DELIVERED: 'badge-green',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
  DELIVERY_FAILED: 'badge-red',
  RETURN_REQUESTED: 'badge-amber',
  RETURNED: 'badge-red',
};

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Đã gán shipper',
  PICKED_FROM_STORE: 'Đã lấy hàng từ cửa hàng',
  OUT_FOR_DELIVERY: 'Đang giao',
  ARRIVED_AT_CUSTOMER: 'Đã đến nơi giao',
  DELIVERED: 'Giao thành công',
  FAILED: 'Giao thất bại',
};

/** Trạng thái thanh toán — ngôn ngữ hình ảnh tách riêng với trạng thái đơn. */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ thanh toán',
  PROCESSING: 'Đang xử lý',
  SUCCESS: 'Đã thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  REFUNDED: 'Đã hoàn tiền',
  PARTIALLY_REFUNDED: 'Hoàn tiền một phần',
  CANCELLED: 'Đã hủy',
};

export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-amber',
  PROCESSING: 'badge-blue',
  SUCCESS: 'badge-green',
  PAID: 'badge-green',
  FAILED: 'badge-red',
  REFUNDED: 'badge-gray',
  PARTIALLY_REFUNDED: 'badge-amber',
  CANCELLED: 'badge-gray',
};

/** Phương thức thanh toán. */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: 'COD (khi nhận hàng)',
  VNPAY: 'VNPay',
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  TRANSFER: 'Chuyển khoản',
};

export const orderStatusLabel = (s: string): string =>
  ORDER_STATUS_LABEL[s] ?? s;
export const paymentStatusLabel = (s: string): string =>
  PAYMENT_STATUS_LABEL[s] ?? s;
export const paymentMethodLabel = (s: string): string =>
  PAYMENT_METHOD_LABEL[s] ?? s;
