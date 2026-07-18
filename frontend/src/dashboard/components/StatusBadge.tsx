interface Props {
  status: string;
  kind?: 'order' | 'payment';
}

const MAP: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: 'Chờ thanh toán', cls: 'dash-badge-amber' },
  PLACED: { label: 'Đã đặt hàng', cls: 'dash-badge-blue' },
  STORE_CONFIRMED: { label: 'Đã xác nhận', cls: 'dash-badge-blue' },
  PICKING: { label: 'Đang soạn', cls: 'dash-badge-amber' },
  PACKED: { label: 'Đã đóng gói', cls: 'dash-badge-amber' },
  READY_FOR_DELIVERY: { label: 'Sẵn sàng giao', cls: 'dash-badge-amber' },
  OUT_FOR_DELIVERY: { label: 'Đang giao', cls: 'dash-badge-blue' },
  DELIVERED: { label: 'Đã giao', cls: 'dash-badge-green' },
  COMPLETED: { label: 'Hoàn tất', cls: 'dash-badge-green' },
  CANCELLED: { label: 'Đã hủy', cls: 'dash-badge-red' },
  DELIVERY_FAILED: { label: 'Giao thất bại', cls: 'dash-badge-red' },
  RETURN_REQUESTED: { label: 'Yêu cầu trả', cls: 'dash-badge-amber' },
  RETURNED: { label: 'Đã trả', cls: 'dash-badge-red' },
  ASSIGNED: { label: 'Đã gán', cls: 'dash-badge-blue' },
  PICKED_FROM_STORE: { label: 'Đã lấy hàng', cls: 'dash-badge-blue' },
  ARRIVED_AT_CUSTOMER: { label: 'Đến khách hàng', cls: 'dash-badge-blue' },
  FAILED: { label: 'Thất bại', cls: 'dash-badge-red' },
  ACTIVE: { label: 'Hoạt động', cls: 'dash-badge-green' },
  PAUSED: { label: 'Tạm dừng', cls: 'dash-badge-amber' },
  CLOSED: { label: 'Đóng cửa', cls: 'dash-badge-slate' },
  SUSPENDED: { label: 'Tạm khóa', cls: 'dash-badge-red' },
  LOCKED: { label: 'Đã khóa', cls: 'dash-badge-red' },
  INACTIVE: { label: 'Không hoạt động', cls: 'dash-badge-slate' },
  PENDING: { label: 'Đang chờ', cls: 'dash-badge-amber' },
  OUT_OF_STOCK: { label: 'Hết hàng', cls: 'dash-badge-red' },
  LOW_STOCK: { label: 'Sắp hết', cls: 'dash-badge-amber' },
  IN_STOCK: { label: 'Còn hàng', cls: 'dash-badge-green' },
  STORE_MANAGER: { label: 'Quản lý', cls: 'dash-badge-green' },
  STORE_STAFF: { label: 'Bán hàng', cls: 'dash-badge-blue' },
  WAREHOUSE_STAFF: { label: 'Kho', cls: 'dash-badge-amber' },
  SHIPPER: { label: 'Giao hàng', cls: 'dash-badge-violet' },
  SUPPORT: { label: 'Hỗ trợ', cls: 'dash-badge-blue' },
  ADMIN: { label: 'Admin', cls: 'dash-badge-red' },
  SUPER_ADMIN: { label: 'Super Admin', cls: 'dash-badge-red' },
};

const PAYMENT_MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Chờ thanh toán', cls: 'dash-badge-amber' },
  PROCESSING: { label: 'Đang xử lý', cls: 'dash-badge-blue' },
  SUCCESS: { label: 'Đã thanh toán', cls: 'dash-badge-green' },
  PAID: { label: 'Đã thanh toán', cls: 'dash-badge-green' },
  FAILED: { label: 'Thất bại', cls: 'dash-badge-red' },
  REFUNDED: { label: 'Đã hoàn tiền', cls: 'dash-badge-slate' },
  PARTIALLY_REFUNDED: { label: 'Hoàn một phần', cls: 'dash-badge-amber' },
  CANCELLED: { label: 'Đã hủy', cls: 'dash-badge-slate' },
};

export function StatusBadge({ status, kind = 'order' }: Props) {
  const table = kind === 'payment' ? PAYMENT_MAP : MAP;
  const value = table[status] ?? { label: status, cls: 'dash-badge-slate' };
  return <span className={'dash-badge ' + value.cls}>{value.label}</span>;
}