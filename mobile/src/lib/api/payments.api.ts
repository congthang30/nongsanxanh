import { apiPost } from './client';

/**
 * Payments. Tao phien thanh toan VNPay cho mot don da tao.
 *
 * Flow (theo spec muc 5.6):
 *   1. Tao order voi paymentMethod = 'VNPAY'.
 *   2. Goi POST /payments { orderId } -> { paymentUrl }.
 *   3. Mo paymentUrl bang Linking.openURL.
 *   4. Khi user quay lai app, order detail refetch de kiem tra trang thai.
 *
 * KHONG fake thanh cong: mobile chi mo URL, backend xac nhan callback VNPay.
 */
export interface CreatePaymentResult {
  paymentUrl: string;
  /** Mot so backend tra them ma giao dich; optional. */
  paymentId?: string;
  transactionRef?: string;
}

export const paymentsApi = {
  create(orderId: string) {
    return apiPost<CreatePaymentResult>('/payments', { orderId });
  },
};
