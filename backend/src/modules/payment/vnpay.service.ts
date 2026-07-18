import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Tao URL thanh toan VNPay (sandbox/prod) va verify chu ky callback.
 *
 * Chuan theo tai lieu sandbox.vnpayment.vn + code demo NodeJS:
 * - vnp_Amount = so tien VND * 100 (khong thap phan)
 * - vnp_CreateDate / vnp_ExpireDate: GMT+7, yyyyMMddHHmmss
 * - vnp_OrderInfo: tieng Viet khong dau, khong ky tu dac biet
 * - Hash: sort key ASC, encodeURIComponent (space -> +), HMAC-SHA512
 * - Query string gui di: encode: false (da encode san trong sortObject)
 *
 * @see https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 */
@Injectable()
export class VnpayService {
  private readonly logger = new Logger(VnpayService.name);

  constructor(private readonly config: ConfigService) {}

  createPaymentUrl(params: {
    orderNumber: string;
    amount: number;
    ipAddr: string;
    orderInfo: string;
  }): string {
    const tmnCode = (this.config.get<string>('VNPAY_TMN_CODE') ?? '').trim();
    const secret = (this.config.get<string>('VNPAY_HASH_SECRET') ?? '').trim();
    const payUrl =
      this.config.get<string>('VNPAY_PAY_URL') ??
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl =
      this.config.get<string>('VNPAY_RETURN_URL') ??
      'http://localhost:3000/api/v1/payments/vnpay/return';

    if (!tmnCode || !secret) {
      this.logger.error(
        'Thieu VNPAY_TMN_CODE / VNPAY_HASH_SECRET — khong tao duoc URL thanh toan',
      );
      throw new BadRequestException({
        code: 'VNPAY_NOT_CONFIGURED',
        message:
          'Chua cau hinh VNPay (VNPAY_TMN_CODE / VNPAY_HASH_SECRET). Kiem tra env backend.',
      });
    }

    const amountVnd = Math.round(Number(params.amount));
    if (!Number.isFinite(amountVnd) || amountVnd <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'So tien thanh toan khong hop le',
      });
    }

    const createDate = this.formatDateGmt7(new Date());
    const expireDate = this.formatDateGmt7(
      new Date(Date.now() + 15 * 60 * 1000),
    );

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: String(params.orderNumber).slice(0, 100),
      vnp_OrderInfo: this.sanitizeOrderInfo(params.orderInfo),
      vnp_OrderType: 'other',
      // 10_000 VND -> 1_000_000 (nhan 100, bo thap phan)
      vnp_Amount: String(amountVnd * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: this.normalizeIp(params.ipAddr),
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    const sorted = this.sortObject(vnpParams);
    const signData = this.stringifyEncodeFalse(sorted);
    const signed = crypto
      .createHmac('sha512', secret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    return `${payUrl}?${signData}&vnp_SecureHash=${signed}`;
  }

  /** Verify chu ky tu callback/return/IPN. */
  verifySignature(query: Record<string, string>): boolean {
    const secret = (this.config.get<string>('VNPAY_HASH_SECRET') ?? '').trim();
    if (!secret) return false;

    const received = query['vnp_SecureHash'];
    if (!received) return false;

    const clone: Record<string, string> = {};
    for (const [k, v] of Object.entries(query)) {
      if (k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue;
      if (v == null || v === '') continue;
      clone[k] = String(v);
    }

    const sorted = this.sortObject(clone);
    const signData = this.stringifyEncodeFalse(sorted);
    const signed = crypto
      .createHmac('sha512', secret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    return signed.toLowerCase() === received.toLowerCase();
  }

  /**
   * Giong sortObject demo NodeJS cua VNPay:
   * encode key/value bang encodeURIComponent, space -> +, roi sort key ASC.
   */
  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
      .sort();

    for (const key of keys) {
      const encKey = encodeURIComponent(key);
      const encVal = encodeURIComponent(String(obj[key])).replace(/%20/g, '+');
      sorted[encKey] = encVal;
    }
    return sorted;
  }

  /** qs.stringify(..., { encode: false }) — noi key=value& da encode san. */
  private stringifyEncodeFalse(sorted: Record<string, string>): string {
    return Object.entries(sorted)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
  }

  /** OrderInfo: khong dau, khong ky tu dac biet (theo quy dinh VNPAY). */
  private sanitizeOrderInfo(raw: string): string {
    const noAccent = String(raw ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
    const cleaned = noAccent
      .replace(/[^a-zA-Z0-9\s.,:_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 255);
    return cleaned || 'Thanh toan don hang';
  }

  /** Chi lay 1 IP (x-forwarded-for co the nhieu), bo prefix IPv6-mapped. */
  private normalizeIp(ip: string): string {
    let v = String(ip ?? '127.0.0.1').split(',')[0].trim();
    if (v.startsWith('::ffff:')) v = v.slice(7);
    if (!v || v === '::1') v = '127.0.0.1';
    return v.slice(0, 45);
  }

  /**
   * Format yyyyMMddHHmmss theo timezone Asia/Ho_Chi_Minh (GMT+7),
   * khong phu thuoc TZ cua container.
   */
  private formatDateGmt7(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '00';
    // en-GB: day/month/year — lay tung part theo type.
    return (
      get('year') +
      get('month') +
      get('day') +
      get('hour') +
      get('minute') +
      get('second')
    );
  }
}
