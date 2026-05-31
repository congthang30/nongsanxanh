/**
 * QR thanh toan POS qua VNPay sandbox.
 *
 * Goi backend `/pos/sales/:id/vnpay-qr` de lay URL thanh toan VNPay
 * (signed bang VNPAY_HASH_SECRET cua chain), sau do encode URL vao QR.
 * Khach mo app VNPay / banking quet QR -> mo trang sandbox VNPay
 * voi dung so tien va vnp_TxnRef = saleNumber.
 */
import { posApi } from '../pos/pos.api';

const QR_RENDER = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=';

export interface PosVnpayQR {
  imageUrl: string;
  payUrl: string;
  amount: number;
  saleNumber: string;
}

export async function fetchPosVnpayQR(saleId: string): Promise<PosVnpayQR> {
  const data = await posApi.vnpayQr(saleId);
  return {
    payUrl: data.payUrl,
    amount: data.amount,
    saleNumber: data.saleNumber,
    imageUrl: `${QR_RENDER}${encodeURIComponent(data.payUrl)}`,
  };
}
