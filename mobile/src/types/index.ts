/**
 * Domain types khop voi backend NestJS (da verify tu controllers/DTOs).
 * Response envelope: { success, data, meta? } — xem lib/api/client.
 */

// ---------------- Auth ----------------
export type RoleCode =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'STORE_MANAGER'
  | 'STORE_STAFF'
  | 'WAREHOUSE_STAFF'
  | 'SHIPPER'
  | 'SUPPORT'
  | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ---------------- Address ----------------
export interface Address {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  line1: string;
  note?: string | null;
  formattedAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  deliveryNote?: string | null;
  isDefault: boolean;
}

export interface CreateAddressInput {
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  line1: string;
  note?: string;
  isDefault?: boolean;
  formattedAddress?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  deliveryNote?: string;
}

// ---------------- Store resolve ----------------
export interface StoreCandidate {
  storeId: string;
  storeName: string;
  storeCode: string;
  province: string;
  district: string | null;
  distanceKm: number | null;
  areaSpecificity: number;
  hasShipper: boolean;
  inStock: boolean;
  outOfStockVariantIds: string[];
  serviceable: boolean;
  reason: string;
}

export interface ResolveStoreResult {
  serviceable: boolean;
  /** Cua hang he thong tu gan (source of truth). Khong cho user ep chon. */
  selectedStore: StoreCandidate | null;
  alternatives: StoreCandidate[];
  reason: string;
  assignmentReason: string | null;
  assignmentDistanceKm: number | null;
  message: string;
}

export interface ResolveStoreInput {
  addressId?: string;
  lat?: number;
  lng?: number;
  province?: string;
  district?: string;
  ward?: string;
  cartItems?: { variantId: string; quantity: number }[];
}

// ---------------- Products ----------------
export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  originRegion?: string | null;
  ratingAvg: number;
  ratingCount: number;
  category: { id: string; name: string; slug: string } | null;
  image: string | null;
  fromPrice: number;
  salePrice?: number | null;
  unit: string;
  available: number;
  storeId: string;
}

export interface ProductVariantDetail {
  id: string;
  sku: string;
  unit: string;
  unitValue?: number | null;
  price: number;
  compareAtPrice?: number | null;
  available: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  originRegion?: string | null;
  storageInstruction?: string | null;
  shelfLifeDays?: number | null;
  ratingAvg: number;
  ratingCount: number;
  category: { id: string; name: string; slug: string } | null;
  images: { id: string; url: string; isPrimary?: boolean }[];
  attributes: { id: string; name?: string; key?: string; value: string }[];
  store: { id: string; name: string; slug: string; province: string; district: string };
  variants: ProductVariantDetail[];
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ---------------- Cart ----------------
export interface CartItem {
  id: string;
  variantId: string;
  productId?: string;
  productName?: string;
  productNameSnapshot?: string;
  unit?: string;
  image?: string | null;
  quantity: number;
  unitPrice?: number;
  unitPriceSnapshot?: number;
  lineTotal?: number;
  available?: number;
}

export interface Cart {
  id: string;
  storeId: string | null;
  storeName?: string | null;
  items: CartItem[];
  subtotal?: number;
  warnings?: string[];
  blockingIssues?: string[];
}

export interface CheckoutQuote {
  selectedStore?: StoreCandidate | null;
  autoAssignedStore?: StoreCandidate | null;
  storeName?: string | null;
  shippingFee: number;
  subtotal?: number;
  discountTotal?: number;
  grandTotal?: number;
  total?: number;
  distanceKm?: number | null;
  etaText?: string | null;
  warnings?: string[];
  serviceable?: boolean;
  message?: string;
}

// ---------------- Orders ----------------
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'STORE_CONFIRMED'
  | 'PICKING'
  | 'PACKED'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DELIVERY_FAILED'
  | 'RETURN_REQUESTED'
  | 'RETURNED';

export type PaymentMethod = 'COD' | 'VNPAY';

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  unitSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusHistory {
  id: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  reason?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  storeId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  grandTotal: number;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  assignmentDistanceKm?: number | null;
  assignmentReason?: string | null;
  note?: string | null;
  createdAt: string;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  store?: { id: string; name: string; phone?: string | null; formattedAddress?: string | null };
  delivery?: Delivery | null;
}

export interface CreateOrderInput {
  addressId: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  note?: string;
}

// ---------------- Delivery / Shipper ----------------
export type DeliveryStatus =
  | 'ASSIGNED'
  | 'PICKED_FROM_STORE'
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVED_AT_CUSTOMER'
  | 'DELIVERED'
  | 'FAILED';

export interface DeliveryEvent {
  id: string;
  status: DeliveryStatus;
  note?: string | null;
  createdAt: string;
}

/**
 * Thong tin giao hang gan vao Order (goc nhin cua customer).
 * Chi doc; mobile khong cap nhat truc tiep (shipper dung DeliveryJob).
 */
export interface Delivery {
  id: string;
  status: DeliveryStatus;
  shipperName?: string | null;
  shipperPhone?: string | null;
  codAmount?: number | null;
  codCollected?: boolean;
  failureReason?: string | null;
  pickedAt?: string | null;
  deliveredAt?: string | null;
  events?: DeliveryEvent[];
}

/** Delivery job gan truc tiep cho shipper cua store. Khong co offer/accept/reject. */
export interface DeliveryJob {
  id: string;
  orderId: string;
  storeId: string;
  shipperId: string;
  status: DeliveryStatus;
  pickupName?: string | null;
  pickupAddress?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffName?: string | null;
  dropoffPhone?: string | null;
  dropoffAddress?: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  distanceKm?: number | null;
  codAmount?: number | null;
  codCollected: boolean;
  failureReason?: string | null;
  pickedAt?: string | null;
  deliveredAt?: string | null;
  updatedAt: string;
  order?: {
    orderNumber: string;
    grandTotal: number;
    paymentMethod: PaymentMethod;
    status: OrderStatus;
    items?: { productNameSnapshot: string; quantity: number; unitSnapshot: string }[];
  };
  store?: { name: string; phone?: string | null; formattedAddress?: string | null };
  events?: DeliveryEvent[];
}
