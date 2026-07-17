import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { PromotionService } from '../promotion/promotion.service';
import { ShippingQuoteService } from '../shipping/shipping-quote.service';
import { StoreResolverService } from '../store/store-resolver.service';
import { AuditService } from '../audit/audit.service';
import { canTransition, CUSTOMER_CANCELLABLE } from './order-state.machine';
import { CreateOrderDto } from './dto/orders.dto';
import { AI_VECTOR_SYNC_EVENT } from '../ai/ai-vector-sync.types';

const orderNo = customAlphabet('0123456789', 10);

/**
 * OrdersService cho mo hinh chuoi cua hang.
 *
 * Tao order trong transaction:
 *   1. resolve store gan nhat/phu hop nhat theo dia chi + cart
 *   2. reserve inventory tai store do
 *   3. create Order voi storeId + shipperId = store.primaryShipperId
 *   4. create Delivery assigned cho shipper chinh cua store
 *   5. create status history + audit log
 *
 * KHONG con tach don theo seller, KHONG con multi-shop.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
    private readonly promotion: PromotionService,
    private readonly shippingQuote: ShippingQuoteService,
    private readonly resolver: StoreResolverService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto, sessionId?: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) {
      throw new BadRequestException({
        code: 'ADDRESS_INVALID',
        message: 'Dia chi giao hang khong hop le',
      });
    }
    if (address.lat == null || address.lng == null) {
      throw new BadRequestException({
        code: 'ADDRESS_NOT_VERIFIED',
        message:
          'Dia chi giao chua co toa do xac thuc. Vui long chon lai dia chi tu goi y ban do.',
      });
    }

    const cart = await this.prisma.cart.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ userId }, ...(sessionId ? [{ sessionId }] : [])],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException({
        code: 'CART_EMPTY',
        message: 'Gio hang trong',
      });
    }

    const cartItems = cart.items.map((it) => ({
      variantId: it.variantId,
      quantity: Number(it.quantity),
    }));

    // 1. Resolve store
    const resolveResult = await this.resolver.resolve({
      lat: address.lat,
      lng: address.lng,
      province: address.province,
      district: address.district,
      ward: address.ward,
      cartItems,
    });
    if (!resolveResult.serviceable || !resolveResult.selectedStore) {
      throw new BadRequestException({
        code: 'NO_SERVICEABLE_STORE',
        message:
          'Khu vuc hoac gio hang nay chua duoc cua hang nao phuc vu day du. Vui long doi dia chi hoac giam so luong.',
        reason: resolveResult.reason,
      });
    }
    const storeId = resolveResult.selectedStore.storeId;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store || !store.primaryShipperId) {
      throw new BadRequestException({
        code: 'STORE_NO_SHIPPER',
        message: 'Cua hang chua co shipper chinh. Vui long thu lai sau.',
      });
    }

    // Gia thuc te tai store
    const variantIds = cartItems.map((i) => i.variantId);
    const priceMap = await this.inventory.getStorePrices(storeId, variantIds);

    const lines = cart.items.map((it) => {
      const unitPrice = priceMap.get(it.variantId) ?? it.variant.price;
      const quantity = Number(it.quantity);
      return {
        productId: it.variant.productId,
        variantId: it.variantId,
        productName: it.variant.product.name,
        sku: it.variant.sku,
        unit: it.variant.unit,
        unitPrice,
        quantity,
        lineTotal: Math.round(unitPrice * quantity),
      };
    });

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

    // Phi ship tu store -> dia chi khach
    const shipQuote = await this.shippingQuote.quote({
      origin: { lat: store.lat ?? 0, lng: store.lng ?? 0 },
      dropoff: { lat: address.lat, lng: address.lng },
      method: 'STANDARD',
      subtotal,
    });

    const { discount, coupon } = await this.promotion.applyCoupon(
      dto.couponCode,
      subtotal,
      userId,
      storeId,
    );
    const grandTotal = subtotal - discount + shipQuote.shippingFee;
    const paymentMethod =
      dto.paymentMethod === 'VNPAY' ? PaymentMethod.VNPAY : PaymentMethod.COD;

    const fullAddress =
      address.formattedAddress ??
      `${address.line1}, ${address.ward}, ${address.district}, ${address.province}`;

    const order = await this.prisma.$transaction(async (tx) => {
      // P0-02: serialize tao don theo cart (pg_advisory_xact_lock giu den het tx)
      // de chong double-click tao 2 don tu cung gio hang.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cart.id}))`;
      // Sau khi gianh lock, kiem tra lai gio con item khong. Neu request truoc
      // da tao don (da xoa cart item) -> request nay bi tu choi.
      const stillHasItems = await tx.cartItem.count({
        where: { cartId: cart.id },
      });
      if (stillHasItems === 0) {
        throw new BadRequestException({
          code: 'ORDER_ALREADY_PLACED',
          message:
            'Don hang dang duoc xu ly. Vui long kiem tra lai danh sach don hang.',
        });
      }
      const created = await tx.order.create({
        data: {
          orderNumber: `NS${orderNo()}`,
          userId,
          storeId,
          shipperId: store.primaryShipperId,
          status: OrderStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.INITIATED,
          paymentMethod,
          subtotal,
          discountTotal: discount,
          shippingFee: shipQuote.shippingFee,
          grandTotal,
          recipientName: address.recipientName,
          recipientPhone: address.phone,
          deliveryAddress: fullAddress,
          deliveryLat: address.lat,
          deliveryLng: address.lng,
          deliveryNote: address.deliveryNote,
          assignmentDistanceKm: resolveResult.assignmentDistanceKm,
          assignmentReason: resolveResult.assignmentReason,
          note: dto.note,
          couponCode: coupon?.code,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              productNameSnapshot: l.productName,
              skuSnapshot: l.sku,
              unitSnapshot: l.unit,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              lineTotal: l.lineTotal,
            })),
          },
          statusHistory: {
            create: { toStatus: OrderStatus.PENDING_PAYMENT, actorId: userId },
          },
        },
      });

      // 2. Reserve inventory tai store
      await this.inventory.reserveForOrder(
        tx,
        storeId,
        created.id,
        cartItems,
        userId,
      );

      // Coupon usage - P0-04: atomic conditional increment chong over-redeem.
      // Chi tang usageCount neu chua cham usageLimit (so sanh cot trong 1 cau lenh).
      if (coupon) {
        const incremented = await tx.$executeRaw`
          UPDATE coupons SET usage_count = usage_count + 1
          WHERE id = ${coupon.id}
            AND (usage_limit IS NULL OR usage_count < usage_limit)
        `;
        if (incremented === 0) {
          throw new BadRequestException({
            code: 'COUPON_EXHAUSTED',
            message: 'Ma giam gia da het luot su dung',
          });
        }
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.id,
            userId,
            orderId: created.id,
            discountAmount: discount,
          },
        });
      }

      // COD: tu dong PLACED ngay. VNPay: cho thanh toan.
      if (paymentMethod === PaymentMethod.COD) {
        await this.transitionInTx(
          tx,
          created.id,
          OrderStatus.PENDING_PAYMENT,
          OrderStatus.PLACED,
          userId,
          'COD - dat hang thanh cong',
        );
        await tx.payment.create({
          data: {
            orderId: created.id,
            method: 'COD',
            amount: grandTotal,
            status: PaymentStatus.PENDING,
          },
        });
      }

      // 4. Tao Delivery assigned cho shipper chinh cua store
      await tx.delivery.create({
        data: {
          orderId: created.id,
          storeId,
          shipperId: store.primaryShipperId!,
          status: DeliveryStatus.ASSIGNED,
          pickupName: store.name,
          pickupAddress: store.formattedAddress ?? store.addressLine,
          pickupLat: store.lat,
          pickupLng: store.lng,
          dropoffName: address.recipientName,
          dropoffPhone: address.phone,
          dropoffAddress: fullAddress,
          dropoffLat: address.lat,
          dropoffLng: address.lng,
          distanceKm: resolveResult.assignmentDistanceKm,
          codAmount: paymentMethod === PaymentMethod.COD ? grandTotal : null,
          events: {
            create: {
              status: DeliveryStatus.ASSIGNED,
              note: 'Tu dong gan cho shipper chinh cua cua hang',
              actorId: 'system',
            },
          },
        },
      });

      // 5. Audit log gan store
      await this.audit.log(
        {
          action: 'ORDER_STORE_ASSIGNED',
          actorId: userId,
          targetType: 'Order',
          targetId: created.id,
          storeId,
          metadata: {
            assignmentReason: resolveResult.assignmentReason,
            distanceKm: resolveResult.assignmentDistanceKm,
            shipperId: store.primaryShipperId,
          },
        },
        tx,
      );

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { storeId: null },
      });
      return created;
    });

    this.events.emit('order.created', { orderId: order.id, userId, storeId });
    if (paymentMethod === PaymentMethod.COD) {
      this.events.emit('order.placed', { orderId: order.id, userId, storeId });
    }
    if (
      coupon?.usageLimit != null &&
      coupon.usageCount + 1 >= coupon.usageLimit
    ) {
      this.events.emit(AI_VECTOR_SYNC_EVENT, {
        objectType: 'COUPON',
        objectId: coupon.id,
        reason: 'usage_limit_reached',
      });
    }
    return this.getOrderForUser(userId, order.id);
  }

  listMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        delivery: true,
        store: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getOrderForUser(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        payments: true,
        delivery: { include: { events: { orderBy: { createdAt: 'asc' } } } },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
            phone: true,
            province: true,
            district: true,
          },
        },
      },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }
    return order;
  }

  async cancelOrder(userId: string, id: string, reason?: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_CANCELLABLE',
        message: 'Don hang khong the huy o trang thai hien tai',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.releaseForOrder(tx, id, userId);
      await this.transitionInTx(
        tx,
        id,
        order.status,
        OrderStatus.CANCELLED,
        userId,
        reason ?? 'Khach huy don',
      );
      await this.audit.log(
        {
          action: 'ORDER_CANCELLED',
          actorId: userId,
          targetType: 'Order',
          targetId: id,
          storeId: order.storeId,
          metadata: { reason, by: 'customer' },
        },
        tx,
      );
    });
    this.events.emit('order.cancelled', { orderId: id, userId });
    return this.getOrderForUser(userId, id);
  }

  // ---------------- Payment callbacks (VNPay) ----------------

  /** Thanh toan online thanh cong: PENDING_PAYMENT -> PLACED. */
  async markPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.SUCCESS },
      });
      if (canTransition(order.status, OrderStatus.PLACED)) {
        await this.transitionInTx(
          tx,
          orderId,
          order.status,
          OrderStatus.PLACED,
          'system',
          'Thanh toan online thanh cong',
        );
      }
    });
    this.events.emit('order.placed', { orderId, storeId: order.storeId });
  }

  /** Thanh toan online that bai: release ton + huy don. */
  async markPaymentFailed(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    await this.prisma.$transaction(async (tx) => {
      await this.inventory.releaseForOrder(tx, orderId, 'system');
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
      if (canTransition(order.status, OrderStatus.CANCELLED)) {
        await this.transitionInTx(
          tx,
          orderId,
          order.status,
          OrderStatus.CANCELLED,
          'system',
          'Thanh toan online that bai',
        );
      }
    });
  }

  /**
   * P0-03: huy cac don VNPAY con PENDING_PAYMENT qua han (mac dinh 30 phut).
   * Release ton dang reserve. Goi dinh ky boi PaymentMaintenanceService.
   * Tra ve so don da huy de log.
   */
  async expireStalePendingPayments(maxAgeMinutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        paymentMethod: PaymentMethod.VNPAY,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });
    let expired = 0;
    for (const o of stale) {
      try {
        await this.markPaymentFailed(o.id);
        expired += 1;
      } catch {
        // Bo qua don loi de khong chan cac don con lai.
      }
    }
    return expired;
  }

  // ---------------- Returns ----------------

  async requestReturn(
    userId: string,
    orderId: string,
    items: { orderItemId: string; quantity: number }[],
    reason: string,
  ) {
    const order = await this.getOrderForUser(userId, orderId);
    const returnable: OrderStatus[] = [
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
    ];
    if (!returnable.includes(order.status)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_RETURNABLE',
        message: 'Chi tra duoc don da giao',
      });
    }
    const validIds = new Set(order.items.map((i) => i.id));
    for (const it of items) {
      if (!validIds.has(it.orderItemId)) {
        throw new BadRequestException({
          code: 'ITEM_NOT_IN_ORDER',
          message: 'San pham khong thuoc don hang',
        });
      }
    }
    const ret = await this.prisma.$transaction(async (tx) => {
      const created = await tx.returnRequest.create({
        data: {
          orderId,
          userId,
          reason,
          status: 'REQUESTED',
          items: {
            create: items.map((it) => ({
              orderItemId: it.orderItemId,
              quantity: it.quantity,
            })),
          },
        },
        include: { items: true },
      });
      await this.transitionInTx(
        tx,
        orderId,
        order.status,
        OrderStatus.RETURN_REQUESTED,
        userId,
        `Yeu cau tra: ${reason}`,
      );
      return created;
    });
    this.events.emit('return.requested', { orderId, returnId: ret.id });
    return ret;
  }

  // ---------------- shared transition helper ----------------

  async transitionInTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    actorId: string,
    reason?: string,
  ) {
    if (!canTransition(from, to)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Khong the chuyen tu ${from} sang ${to}`,
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: from, toStatus: to, actorId, reason },
    });
  }
}
