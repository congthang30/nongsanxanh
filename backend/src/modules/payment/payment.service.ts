import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { VnpayService } from './vnpay.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly vnpay: VnpayService,
  ) {}

  /** Tao payment VNPay va tra URL redirect. */
  async createVnpayPayment(userId: string, orderId: string, ip: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }
    if (order.paymentStatus === PaymentStatus.SUCCESS) {
      throw new BadRequestException({
        code: 'ALREADY_PAID',
        message: 'Don hang da duoc thanh toan',
      });
    }

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'VNPAY',
        provider: 'VNPAY',
        amount: order.grandTotal,
        status: PaymentStatus.PENDING,
      },
    });

    const paymentUrl = this.vnpay.createPaymentUrl({
      orderNumber: order.orderNumber,
      amount: order.grandTotal,
      ipAddr: ip,
      orderInfo: `Thanh toan don ${order.orderNumber}`,
    });

    return { paymentUrl };
  }

  /**
   * Xu ly callback VNPay (return/IPN). Idempotent theo orderNumber + responseCode.
   */
  async handleVnpayCallback(query: Record<string, string>) {
    const valid = this.vnpay.verifySignature(query);
    if (!valid) {
      throw new BadRequestException({
        code: 'INVALID_SIGNATURE',
        message: 'Chu ky khong hop le',
      });
    }

    const orderNumber = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionId = query['vnp_TransactionNo'];

    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { payments: { where: { method: 'VNPAY' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }

    // Idempotency: neu da xu ly transaction nay roi thi tra ket qua cu
    if (transactionId) {
      const existing = await this.prisma.paymentTransaction.findUnique({
        where: { providerTransactionId: transactionId },
      });
      if (existing) {
        return {
          code: responseCode,
          orderNumber,
          status: order.paymentStatus,
          idempotent: true,
        };
      }
    }

    const payment = order.payments[0];
    const success = responseCode === '00';

    await this.prisma.paymentTransaction.create({
      data: {
        paymentId: payment?.id ?? (await this.ensurePayment(order.id, order.grandTotal)),
        providerTransactionId: transactionId || undefined,
        callbackPayload: query as object,
        status: success ? 'SUCCESS' : 'FAILED',
      },
    });

    if (success) {
      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.SUCCESS, paidAt: new Date() },
        });
      }
      await this.orders.markPaid(order.id);
    } else {
      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED },
        });
      }
      await this.orders.markPaymentFailed(order.id);
    }

    return { code: responseCode, orderNumber, success };
  }

  private async ensurePayment(orderId: string, amount: number): Promise<string> {
    const p = await this.prisma.payment.create({
      data: { orderId, method: 'VNPAY', provider: 'VNPAY', amount, status: PaymentStatus.PENDING },
    });
    return p.id;
  }
}
