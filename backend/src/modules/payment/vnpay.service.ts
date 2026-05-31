import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Tao URL thanh toan VNPay va verify chu ky callback (sandbox).
 * Tham khao chuan vnp_* params + HMAC-SHA512.
 */
@Injectable()
export class VnpayService {
  constructor(private readonly config: ConfigService) {}

  createPaymentUrl(params: {
    orderNumber: string;
    amount: number;
    ipAddr: string;
    orderInfo: string;
  }): string {
    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE') ?? '';
    const secret = this.config.get<string>('VNPAY_HASH_SECRET') ?? '';
    const payUrl =
      this.config.get<string>('VNPAY_PAY_URL') ??
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl =
      this.config.get<string>('VNPAY_RETURN_URL') ??
      'http://localhost:5173/payment/vnpay/return';

    const now = new Date();
    const createDate = this.formatDate(now);

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderNumber,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: String(params.amount * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: createDate,
    };

    const sorted = this.sortObject(vnpParams);
    const signData = new URLSearchParams(sorted).toString();
    const hmac = crypto.createHmac('sha512', secret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    sorted['vnp_SecureHash'] = signed;

    return `${payUrl}?${new URLSearchParams(sorted).toString()}`;
  }

  /** Verify chu ky tu callback/return. */
  verifySignature(query: Record<string, string>): boolean {
    const secret = this.config.get<string>('VNPAY_HASH_SECRET') ?? '';
    const received = query['vnp_SecureHash'];
    const clone = { ...query };
    delete clone['vnp_SecureHash'];
    delete clone['vnp_SecureHashType'];

    const sorted = this.sortObject(clone);
    const signData = new URLSearchParams(sorted).toString();
    const hmac = crypto.createHmac('sha512', secret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    return signed === received;
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {});
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      date.getFullYear().toString() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }
}
