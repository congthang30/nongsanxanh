import { api, unwrap } from '../lib/api';

// ---------------- Types ----------------

export type POSSaleStatus =
  | 'DRAFT'
  | 'HELD'
  | 'PAID'
  | 'VOIDED'
  | 'REFUNDED'
  | 'PARTIAL_REFUNDED';

export type POSPaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER_MANUAL'
  | 'CARD'
  | 'VNPAY'
  | 'MOMO'
  | 'ZALOPAY';

export interface BarcodeLookup {
  barcode: string;
  barcodeType: string;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  unit: string;
  saleMode: 'UNIT' | 'WEIGHT';
  allowDecimalQuantity: boolean;
  unitPrice: number;
  available: number;
  inStock: boolean;
}

export interface SaleItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  unit: string;
  barcode: string | null;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  lineTotal: number;
}

export interface SalePayment {
  method: POSPaymentMethod;
  amount: number;
  tendered: number | null;
  change: number | null;
  reference: string | null;
  status: string;
}

export interface POSSale {
  id: string;
  saleNumber: string;
  status: POSSaleStatus;
  paymentStatus: string;
  storeId: string;
  storeName: string;
  cashierId: string;
  cashierName: string;
  shiftId: string | null;
  customerPhone: string | null;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  changeAmount: number;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  payments: SalePayment[];
}

export interface CashierShift {
  id: string;
  storeId: string;
  storeName: string;
  cashierId: string;
  cashierName: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  expectedCash: number;
  countedCash: number | null;
  cashDifference: number | null;
  paidSaleCount: number;
  paidRevenue: number;
  note: string | null;
}

export interface ReceiptData {
  saleNumber: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  store: { name: string; code: string; address: string | null; phone: string | null };
  cashier: { name: string };
  customerPhone: string | null;
  items: {
    name: string; sku: string; unit: string; barcode: string | null;
    unitPrice: number; quantity: number; discountAmount: number; lineTotal: number;
  }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  changeAmount: number;
  payments: SalePayment[];
  hotline: string;
}

// ---------------- API ----------------

export const posApi = {
  currentShift: () => unwrap<CashierShift | null>(api.get('/pos/shifts/current')),
  openShift: (openingCash: number, note?: string) =>
    unwrap<CashierShift>(api.post('/pos/shifts/open', { openingCash, note })),
  closeShift: (countedCash: number, note?: string) =>
    unwrap<CashierShift>(api.post('/pos/shifts/close', { countedCash, note })),

  lookup: (barcode: string) =>
    unwrap<BarcodeLookup>(api.get('/pos/products/lookup', { params: { barcode } })),
  search: (q: string) =>
    unwrap<BarcodeLookup[]>(api.get('/pos/products/search', { params: { q } })),

  createSale: (customerPhone?: string) =>
    unwrap<POSSale>(api.post('/pos/sales', { customerPhone })),
  getSale: (id: string) => unwrap<POSSale>(api.get(`/pos/sales/${id}`)),
  heldSales: () =>
    unwrap<{ id: string; saleNumber: string; grandTotal: number; itemCount: number; customerPhone: string | null; updatedAt: string }[]>(
      api.get('/pos/sales/held'),
    ),
  scan: (saleId: string, barcode: string, quantity?: number) =>
    unwrap<{ sale: POSSale; scanned: BarcodeLookup }>(
      api.post(`/pos/sales/${saleId}/scan`, { barcode, quantity }),
    ),
  updateItem: (saleId: string, itemId: string, quantity: number) =>
    unwrap<POSSale>(api.patch(`/pos/sales/${saleId}/items/${itemId}`, { quantity })),
  removeItem: (saleId: string, itemId: string) =>
    unwrap<POSSale>(api.delete(`/pos/sales/${saleId}/items/${itemId}`)),
  hold: (saleId: string) => unwrap<POSSale>(api.post(`/pos/sales/${saleId}/hold`, {})),
  resume: (saleId: string) => unwrap<POSSale>(api.post(`/pos/sales/${saleId}/resume`, {})),
  pay: (saleId: string, payments: { method: POSPaymentMethod; amount: number; tendered?: number; reference?: string }[]) =>
    unwrap<POSSale>(api.post(`/pos/sales/${saleId}/pay`, { payments })),
  voidSale: (saleId: string, reason: string) =>
    unwrap<POSSale>(api.post(`/pos/sales/${saleId}/void`, { reason })),
  receipt: (saleId: string) => unwrap<ReceiptData>(api.get(`/pos/sales/${saleId}/receipt`)),
};

export const PAYMENT_LABELS: Record<POSPaymentMethod, string> = {
  CASH: 'Tien mat',
  BANK_TRANSFER_MANUAL: 'Chuyen khoan',
  CARD: 'The',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  ZALOPAY: 'ZaloPay',
};
