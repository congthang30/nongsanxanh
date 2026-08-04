import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  POSPaymentMethod,
  POSPaymentRecordStatus,
  POSPaymentStatus,
  POSSaleStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { VnpayService } from './vnpay.service';

/** Ket qua chuan hoa cho callback de controller map sang format phu hop. */
export interface VnpayCallbackResult {
  code: string;
  orderNumber: string;
  success: boolean;
  status: PaymentStatus | POSPaymentStatus;
  /** Callback cua hoa don tai quay. */
  pos?: boolean;
  saleId?: string;
  /** Da xu ly truoc do (idempotent replay). */
  idempotent?: boolean;
  /** So tien callback khong khop order -> tu choi. */
  amountMismatch?: boolean;
  /** Thanh toan thanh cong nhung don da huy -> tao refund cho. */
  refundPending?: boolean;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly vnpay: VnpayService,
    private readonly audit: AuditService,
    private readonly inventory: StoreInventoryService,
  ) {}

  /** Tao payment VNPay va tra URL redirect. Tai su dung payment PENDING neu co. */
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
    // P1-09: khong tao URL thanh toan cho don da huy.
    if (
      order.status === OrderStatus.CANCELLED ||
      order.paymentStatus === PaymentStatus.CANCELLED
    ) {
      throw new BadRequestException({
        code: 'ORDER_CANCELLED',
        message: 'Don hang da bi huy, khong the thanh toan',
      });
    }

    // P1-05: chi tao Payment PENDING moi neu chua co (tranh sinh nhieu record rac).
    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        method: 'VNPAY',
        status: PaymentStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          method: 'VNPAY',
          provider: 'VNPAY',
          amount: order.grandTotal,
          status: PaymentStatus.PENDING,
        },
      });
    }

    const paymentUrl = this.vnpay.createPaymentUrl({
      orderNumber: order.orderNumber,
      amount: order.grandTotal,
      ipAddr: ip,
      orderInfo: `Thanh toan don ${order.orderNumber}`,
    });

    return { paymentUrl };
  }

  /**
   * Xu ly callback VNPay (return/IPN). Idempotent theo idempotencyKey duy nhat.
   * Cac kiem tra an toan tien:
   *   - P0-01: verify vnp_Amount === order.grandTotal * 100.
   *   - P0-07: idempotencyKey unique chong double-callback / replay.
   *   - P1-01: neu don da CANCELLED ma callback success -> tao Refund cho, KHONG mark paid.
   *   - P2-12: strip cac truong chu ky truoc khi luu payload.
   */
  async handleVnpayCallback(
    query: Record<string, string>,
  ): Promise<VnpayCallbackResult> {
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
    const amountRaw = query['vnp_Amount'];

    if (orderNumber.startsWith('POS')) {
      return this.handlePosVnpayCallback(query);
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        payments: {
          where: { method: 'VNPAY' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }

    // P0-07: idempotency key on bao gom orderNumber + responseCode + transactionId.
    // Neu da xu ly (hoac return + IPN cung den) -> tra ket qua cu, khong xu ly lai.
    const idempotencyKey = `vnpay|${orderNumber}|${responseCode}|${transactionId ?? 'na'}`;
    const existingTxn = await this.prisma.paymentTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existingTxn) {
      return {
        code: responseCode,
        orderNumber,
        success: order.paymentStatus === PaymentStatus.SUCCESS,
        status: order.paymentStatus,
        idempotent: true,
      };
    }

    const success = responseCode === '00';

    // Dam bao co Payment record de gan transaction (P1-06).
    let payment = order.payments[0];
    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId: order.id,
          method: 'VNPAY',
          provider: 'VNPAY',
          amount: order.grandTotal,
          status: PaymentStatus.PENDING,
        },
      });
    }

    // P0-01: verify so tien tu cong thanh toan == grandTotal (VND x100).
    let amountMismatch = false;
    if (success && amountRaw != null) {
      const expected = order.grandTotal * 100;
      if (Number(amountRaw) !== expected) {
        amountMismatch = true;
      }
    }

    const effectiveSuccess = success && !amountMismatch;

    // P2-12: khong luu cac truong chu ky/bi mat trong callbackPayload.
    const safePayload = this.stripSecrets(query);

    // Ghi PaymentTransaction voi idempotencyKey. Neu unique violation (callback
    // song song den cung luc) -> coi nhu da xu ly, tra idempotent.
    try {
      await this.prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          providerTransactionId: transactionId || undefined,
          idempotencyKey,
          callbackPayload: safePayload as object,
          status: effectiveSuccess ? 'SUCCESS' : 'FAILED',
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return {
          code: responseCode,
          orderNumber,
          success: order.paymentStatus === PaymentStatus.SUCCESS,
          status: order.paymentStatus,
          idempotent: true,
        };
      }
      throw e;
    }

    // P0-01: amount sai -> KHONG mark paid, danh dau FAILED + audit de doi soat.
    if (amountMismatch) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      await this.audit.log({
        action: 'PAYMENT_AMOUNT_MISMATCH',
        actorId: 'system',
        targetType: 'Order',
        targetId: order.id,
        storeId: order.storeId,
        metadata: {
          orderNumber,
          expectedAmount: order.grandTotal * 100,
          receivedAmount: Number(amountRaw),
          transactionId,
        },
      });
      this.logger.warn(
        `VNPay amount mismatch order=${orderNumber} expected=${order.grandTotal * 100} got=${amountRaw}`,
      );
      return {
        code: responseCode,
        orderNumber,
        success: false,
        status: PaymentStatus.FAILED,
        amountMismatch: true,
      };
    }

    if (effectiveSuccess) {
      // P1-01: don da huy nhung tien da vao -> tao Refund cho, khong mark paid.
      if (order.status === OrderStatus.CANCELLED) {
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.REFUND_PENDING, paidAt: new Date() },
          });
          await tx.refund.create({
            data: {
              paymentId: payment.id,
              orderId: order.id,
              amount: order.grandTotal,
              status: 'PENDING',
              reason: 'Thanh toan thanh cong cho don da huy - can hoan tien',
            },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: PaymentStatus.REFUND_PENDING },
          });
          await this.audit.log(
            {
              action: 'PAYMENT_ON_CANCELLED_ORDER',
              actorId: 'system',
              targetType: 'Order',
              targetId: order.id,
              storeId: order.storeId,
              metadata: { orderNumber, amount: order.grandTotal, transactionId },
            },
            tx,
          );
        });
        return {
          code: responseCode,
          orderNumber,
          success: true,
          status: PaymentStatus.REFUND_PENDING,
          refundPending: true,
        };
      }

      const finalStatus = await this.orders.markPaid(order.id, payment.id);
      return {
        code: responseCode,
        orderNumber,
        success: true,
        status: finalStatus,
        ...(finalStatus === PaymentStatus.REFUND_PENDING
          ? { refundPending: true }
          : {}),
      };
    }

    // That bai -> FAILED + release ton + huy don (markPaymentFailed da idempotent qua state machine).
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    await this.orders.markPaymentFailed(order.id);
    return {
      code: responseCode,
      orderNumber,
      success: false,
      status: PaymentStatus.FAILED,
    };
  }

  /**
   * Chot hoa don POS tu callback VNPay. Khong dung endpoint /pos/.../pay vi callback
   * la public/system actor; khoa sale trong transaction de chong return + IPN tru ton hai lan.
   */
  private async handlePosVnpayCallback(
    query: Record<string, string>,
  ): Promise<VnpayCallbackResult> {
    const saleNumber = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionId = query['vnp_TransactionNo'];
    const reference = transactionId || `${responseCode}-${query['vnp_PayDate'] ?? 'unknown'}`;
    const sale = await this.prisma.pOSSale.findUnique({
      where: { saleNumber },
      select: { id: true, storeId: true, cashierId: true },
    });
    if (!sale) {
      throw new NotFoundException({
        code: 'SALE_NOT_FOUND',
        message: 'Khong tim thay hoa don POS',
      });
    }

    if (responseCode !== '00') {
      return {
        code: responseCode,
        orderNumber: saleNumber,
        success: false,
        status: POSPaymentStatus.FAILED,
        pos: true,
        saleId: sale.id,
      };
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { status: POSSaleStatus; payment_status: POSPaymentStatus; grand_total: number }[]
      >(Prisma.sql`
        SELECT status, payment_status, grand_total
        FROM pos_sales
        WHERE id = ${sale.id}
        FOR UPDATE
      `);
      const current = locked[0];
      if (!current) {
        throw new NotFoundException({
          code: 'SALE_NOT_FOUND',
          message: 'Khong tim thay hoa don POS',
        });
      }

      const expectedAmount = Number(current.grand_total) * 100;
      if (Number(query['vnp_Amount']) !== expectedAmount) {
        return { kind: 'amount-mismatch' as const, expectedAmount };
      }

      const existingPayment = await tx.pOSPayment.findFirst({
        where: {
          saleId: sale.id,
          method: POSPaymentMethod.VNPAY,
          status: POSPaymentRecordStatus.SUCCESS,
          reference,
        },
      });
      if (existingPayment) return { kind: 'idempotent' as const };

      if (
        current.status !== POSSaleStatus.DRAFT &&
        current.status !== POSSaleStatus.HELD
      ) {
        // Tien da vao sau khi hoa don duoc chot/huy bang luong khac: luu de
        // doi soat/hoan tien, tuyet doi khong tru ton lan nua.
        await tx.pOSPayment.create({
          data: {
            saleId: sale.id,
            method: POSPaymentMethod.VNPAY,
            amount: Number(current.grand_total),
            status: POSPaymentRecordStatus.SUCCESS,
            reference,
            paidAt: new Date(),
          },
        });
        await this.audit.log(
          {
            action: 'POS_DUPLICATE_PAYMENT_REQUIRES_REFUND',
            actorId: null,
            targetType: 'POSSale',
            targetId: sale.id,
            storeId: sale.storeId,
            metadata: { saleNumber, transactionId, currentStatus: current.status },
          },
          tx,
        );
        return { kind: 'refund-pending' as const };
      }

      const items = await tx.pOSSaleItem.findMany({ where: { saleId: sale.id } });
      if (items.length === 0) {
        throw new BadRequestException({
          code: 'EMPTY_SALE',
          message: 'Hoa don POS chua co san pham',
        });
      }

      const grandTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      if (grandTotal * 100 !== expectedAmount) {
        throw new BadRequestException({
          code: 'POS_TOTAL_DESYNC',
          message: 'Tong tien hoa don POS khong dong bo',
        });
      }

      await this.inventory.commitPosSale(
        tx,
        sale.storeId,
        items.map((item) => ({
          saleItemId: item.id,
          variantId: item.variantId,
          quantity: Number(item.quantity),
        })),
        saleNumber,
        sale.cashierId,
      );
      await tx.pOSPayment.create({
        data: {
          saleId: sale.id,
          method: POSPaymentMethod.VNPAY,
          amount: grandTotal,
          status: POSPaymentRecordStatus.SUCCESS,
          reference,
          paidAt: new Date(),
        },
      });
      await tx.pOSSale.update({
        where: { id: sale.id },
        data: {
          status: POSSaleStatus.PAID,
          paymentStatus: POSPaymentStatus.PAID,
          subtotal: items.reduce(
            (sum, item) => sum + item.lineTotal + item.discountAmount,
            0,
          ),
          discountTotal: items.reduce(
            (sum, item) => sum + item.discountAmount,
            0,
          ),
          grandTotal,
          amountPaid: grandTotal,
          changeAmount: 0,
          paidAt: new Date(),
        },
      });
      await this.audit.log(
        {
          action: 'POS_SALE_PAID',
          actorId: null,
          targetType: 'POSSale',
          targetId: sale.id,
          storeId: sale.storeId,
          metadata: {
            saleNumber,
            grandTotal,
            methods: [POSPaymentMethod.VNPAY],
            transactionId,
          },
        },
        tx,
      );
      return { kind: 'paid' as const };
    });

    if (outcome.kind === 'amount-mismatch') {
      await this.audit.log({
        action: 'POS_PAYMENT_AMOUNT_MISMATCH',
        actorId: null,
        targetType: 'POSSale',
        targetId: sale.id,
        storeId: sale.storeId,
        metadata: {
          saleNumber,
          expectedAmount: outcome.expectedAmount,
          receivedAmount: Number(query['vnp_Amount']),
          transactionId,
        },
      });
      return {
        code: responseCode,
        orderNumber: saleNumber,
        success: false,
        status: POSPaymentStatus.PENDING,
        amountMismatch: true,
        pos: true,
        saleId: sale.id,
      };
    }

    return {
      code: responseCode,
      orderNumber: saleNumber,
      success: true,
      status:
        outcome.kind === 'refund-pending'
          ? PaymentStatus.REFUND_PENDING
          : POSPaymentStatus.PAID,
      pos: true,
      saleId: sale.id,
      ...(outcome.kind === 'idempotent' ? { idempotent: true } : {}),
      ...(outcome.kind === 'refund-pending' ? { refundPending: true } : {}),
    };
  }

  /** Loai bo cac truong chu ky/bi mat khoi payload truoc khi luu DB (P2-12). */
  private stripSecrets(query: Record<string, string>): Record<string, string> {
    const clone = { ...query };
    delete clone['vnp_SecureHash'];
    delete clone['vnp_SecureHashType'];
    return clone;
  }
}
