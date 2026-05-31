interface Props {
  status: string;
}

const MAP: Record<string, { label: string; cls: string }> = {
  // Order lifecycle
  PENDING_PAYMENT: { label: 'Cho thanh toan', cls: 'dash-badge-amber' },
  PLACED: { label: 'Da dat hang', cls: 'dash-badge-blue' },
  STORE_CONFIRMED: { label: 'Da xac nhan', cls: 'dash-badge-blue' },
  PICKING: { label: 'Dang soan', cls: 'dash-badge-amber' },
  PACKED: { label: 'Da dong goi', cls: 'dash-badge-amber' },
  READY_FOR_DELIVERY: { label: 'San sang giao', cls: 'dash-badge-amber' },
  OUT_FOR_DELIVERY: { label: 'Dang giao', cls: 'dash-badge-blue' },
  DELIVERED: { label: 'Da giao', cls: 'dash-badge-green' },
  COMPLETED: { label: 'Hoan tat', cls: 'dash-badge-green' },
  CANCELLED: { label: 'Da huy', cls: 'dash-badge-red' },
  DELIVERY_FAILED: { label: 'Giao that bai', cls: 'dash-badge-red' },
  RETURN_REQUESTED: { label: 'Yeu cau tra', cls: 'dash-badge-amber' },
  RETURNED: { label: 'Da tra', cls: 'dash-badge-red' },
  // Delivery
  ASSIGNED: { label: 'Da gan', cls: 'dash-badge-blue' },
  PICKED_FROM_STORE: { label: 'Da lay hang', cls: 'dash-badge-blue' },
  ARRIVED_AT_CUSTOMER: { label: 'Den khach', cls: 'dash-badge-blue' },
  FAILED: { label: 'That bai', cls: 'dash-badge-red' },
  // Store / inventory
  ACTIVE: { label: 'Hoat dong', cls: 'dash-badge-green' },
  PAUSED: { label: 'Tam dung', cls: 'dash-badge-amber' },
  CLOSED: { label: 'Dong cua', cls: 'dash-badge-slate' },
  SUSPENDED: { label: 'Tam khoa', cls: 'dash-badge-red' },
  INACTIVE: { label: 'Tat', cls: 'dash-badge-slate' },
  OUT_OF_STOCK: { label: 'Het hang', cls: 'dash-badge-red' },
  // Staff roles
  STORE_MANAGER: { label: 'Quan ly', cls: 'dash-badge-green' },
  STORE_STAFF: { label: 'Ban hang', cls: 'dash-badge-blue' },
  WAREHOUSE_STAFF: { label: 'Kho', cls: 'dash-badge-amber' },
  SHIPPER: { label: 'Shipper', cls: 'dash-badge-blue' },
};

export function StatusBadge({ status }: Props) {
  const m = MAP[status] ?? { label: status, cls: 'dash-badge-slate' };
  return <span className={`dash-badge ${m.cls}`}>{m.label}</span>;
}
