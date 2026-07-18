import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ROLE } from '../../common/constants/roles.constant';
import { CreateReviewDto } from './dto/reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  listForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        images: true,
        user: {
          include: { profile: { select: { fullName: true, avatarUrl: true } } },
        },
      },
    });
  }

  /**
   * Chi khach hang (role CUSTOMER) duoc danh gia.
   * Cho phep sau khi thanh toan SUCCESS, hoac don da giao/hoan tat (COD).
   * Moi orderItem chi danh gia 1 lan / user.
   */
  async create(
    userId: string,
    roles: string[],
    orderId: string,
    dto: CreateReviewDto,
  ) {
    if (!roles.includes(ROLE.CUSTOMER)) {
      throw new ForbiddenException({
        code: 'CUSTOMER_ONLY',
        message: 'Chỉ tài khoản khách hàng mới được đánh giá sản phẩm',
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Không tìm thấy đơn hàng',
      });
    }

    const paid =
      order.paymentStatus === PaymentStatus.SUCCESS ||
      order.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED;
    const delivered =
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.COMPLETED;

    if (!paid && !delivered) {
      throw new BadRequestException({
        code: 'ORDER_NOT_ELIGIBLE_FOR_REVIEW',
        message:
          'Chỉ đánh giá được sau khi thanh toán thành công hoặc đơn đã giao',
      });
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'ORDER_CANCELLED',
        message: 'Không thể đánh giá đơn đã hủy',
      });
    }

    const item = order.items.find((i) => i.id === dto.orderItemId);
    if (!item) {
      throw new BadRequestException({
        code: 'ITEM_NOT_IN_ORDER',
        message: 'Sản phẩm không thuộc đơn hàng này',
      });
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        orderItemId_userId: { orderItemId: item.id, userId },
      },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'ALREADY_REVIEWED',
        message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng',
      });
    }

    try {
      const review = await this.prisma.$transaction(async (tx) => {
        const r = await tx.review.create({
          data: {
            userId,
            productId: item.productId,
            orderItemId: item.id,
            rating: dto.rating,
            comment: dto.comment?.trim() || null,
            images: dto.images?.length
              ? { create: dto.images.map((url) => ({ url })) }
              : undefined,
          },
        });

        const agg = await tx.review.aggregate({
          where: { productId: item.productId, status: 'ACTIVE' },
          _avg: { rating: true },
          _count: true,
        });
        await tx.product.update({
          where: { id: item.productId },
          data: {
            ratingAvg: agg._avg.rating ?? 0,
            ratingCount: agg._count,
          },
        });
        return r;
      });
      return review;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException({
          code: 'ALREADY_REVIEWED',
          message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng',
        });
      }
      throw error;
    }
  }
}
