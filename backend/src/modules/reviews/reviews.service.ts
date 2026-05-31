import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
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
        user: { include: { profile: { select: { fullName: true, avatarUrl: true } } } },
      },
    });
  }

  /** Chi cho review san pham trong don da DELIVERED/COMPLETED cua chinh user. */
  async create(userId: string, orderId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }
    if (
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.COMPLETED
    ) {
      throw new BadRequestException({
        code: 'ORDER_NOT_DELIVERED',
        message: 'Chi danh gia duoc don da giao',
      });
    }
    const item = order.items.find((i) => i.id === dto.orderItemId);
    if (!item) {
      throw new BadRequestException({
        code: 'ITEM_NOT_IN_ORDER',
        message: 'San pham khong thuoc don hang',
      });
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: {
          userId,
          productId: item.productId,
          orderItemId: item.id,
          rating: dto.rating,
          comment: dto.comment,
          images: dto.images
            ? { create: dto.images.map((url) => ({ url })) }
            : undefined,
        },
      });

      // Cap nhat rating trung binh san pham
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
  }
}
