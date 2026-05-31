export const formatVnd = (n: number): string =>
  new Intl.NumberFormat('vi-VN').format(n) + '\u0111';

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Cho thanh toan',
  PLACED: 'Da dat hang',
  STORE_CONFIRMED: 'Cua hang da xac nhan',
  PICKING: 'Dang soan hang',
  PACKED: 'Da dong goi',
  READY_FOR_DELIVERY: 'San sang giao',
  OUT_FOR_DELIVERY: 'Dang giao',
  DELIVERED: 'Da giao',
  COMPLETED: 'Hoan thanh',
  CANCELLED: 'Da huy',
  DELIVERY_FAILED: 'Giao that bai',
  RETURN_REQUESTED: 'Yeu cau tra',
  RETURNED: 'Da tra',
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
  ASSIGNED: 'Da gan shipper',
  PICKED_FROM_STORE: 'Da lay hang tu cua hang',
  OUT_FOR_DELIVERY: 'Dang giao',
  ARRIVED_AT_CUSTOMER: 'Da den noi giao',
  DELIVERED: 'Giao thanh cong',
  FAILED: 'Giao that bai',
};
