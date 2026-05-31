import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface CouponResult {
  coupon: {
    id: string;
    code: string;
    scope: string;
    storeId: string | null;
  } | null;
  discount: number;
}

@Injectable()
export class PromotionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate + tinh giam gia tu coupon.
   *
   * - Voucher PLATFORM: ap dung tren tong subtotal cua moi cua hang.
   * - Voucher STORE: chi ap dung neu storeId khop coupon.storeId.
   *
   * @param code      Ma coupon
   * @param subtotal  Tong tien items (VND)
   * @param userId    User dung coupon (de check perUserLimit)
   * @param storeId   Cua hang dang mua. Coupon STORE -> bat buoc khop.
   */
  async applyCoupon(
    code: string | undefined,
    subtotal: number,
    userId?: string,
    storeId?: string,
  ): Promise<CouponResult> {
    if (!code) return { coupon: null, discount: 0 };

    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    const now = new Date();
    if (
      !coupon ||
      coupon.status !== 'ACTIVE' ||
      coupon.startsAt > now ||
      coupon.endsAt < now
    ) {
      throw new BadRequestException({
        code: 'COUPON_INVALID',
        message: 'Ma giam gia khong hop le hoac da het han',
      });
    }
    // STORE voucher chi ap dung dung cua hang
    if (coupon.scope === 'STORE') {
      if (!storeId) {
        throw new BadRequestException({
          code: 'COUPON_STORE_SCOPE',
          message: 'Voucher cua hang chi ap dung khi mua tu chinh cua hang do',
        });
      }
      if (coupon.storeId !== storeId) {
        throw new BadRequestException({
          code: 'COUPON_STORE_MISMATCH',
          message: 'Voucher nay khong thuoc cua hang hien tai',
        });
      }
    }
    if (subtotal < coupon.minOrderValue) {
      throw new BadRequestException({
        code: 'COUPON_MIN_ORDER',
        message: `Don hang toi thieu ${coupon.minOrderValue} de dung ma nay`,
      });
    }
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException({
        code: 'COUPON_EXHAUSTED',
        message: 'Ma giam gia da het luot su dung',
      });
    }
    if (coupon.perUserLimit != null && userId) {
      const used = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });
      if (used >= coupon.perUserLimit) {
        throw new BadRequestException({
          code: 'COUPON_USER_LIMIT',
          message: 'Ban da dung het luot cho ma nay',
        });
      }
    }

    let discount = 0;
    if (coupon.type === 'PERCENT') {
      discount = Math.floor((subtotal * coupon.value) / 100);
    } else {
      discount = coupon.value;
    }
    if (coupon.maxDiscount != null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    discount = Math.min(discount, subtotal);

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        scope: coupon.scope,
        storeId: coupon.storeId,
      },
      discount,
    };
  }
}
