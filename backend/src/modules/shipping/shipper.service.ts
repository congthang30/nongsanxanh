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
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { canDeliveryTransition } from '../orders/delivery-state.machine';
import { canTransition } from '../orders/order-state.machine';

/**
 * Shipper jobs service. Shipper chinh cua cua hang nhan delivery TRUC TIEP,
 * khong co offer/accept/reject. Moi thao tac kiem tra delivery.shipperId == user.id.
 *
 * Vong doi: ASSIGNED -> PICKED_FROM_STORE -> OUT_FOR_DELIVERY
 *   -> ARRIVED_AT_CUSTOMER -> DELIVERED | FAILED
 *
 * Dong bo trang thai don:
 *   PICKED_FROM_STORE  -> order READY_FOR_DELIVERY (neu chua) / OUT_FOR_DELIVERY
 *   OUT_FOR_DELIVERY   -> order OUT_FOR_DELIVERY
 *   DELIVERED          -> order DELIVERED -> COMPLETED + commit inventory
 *   FAILED             -> order DELIVERY_FAILED
 */
@Injectable()
export class ShipperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** Don dang can giao / dang giao cua shipper. */
  listJobs(shipperId: string, scope?: 'active' | 'history') {
    const activeStatuses: DeliveryStatus[] = [
      DeliveryStatus.ASSIGNED,
      DeliveryStatus.PICKED_FROM_STORE,
      DeliveryStatus.OUT_FOR_DELIVERY,
      DeliveryStatus.ARRIVED_AT_CUSTOMER,
    ];
    const historyStatuses: DeliveryStatus[] = [
      DeliveryStatus.DELIVERED,
      DeliveryStatus.FAILED,
    ];
    return this.prisma.delivery.findMany({
      where: {
        shipperId,
        status: {
          in: scope === 'history' ? historyStatuses : activeStatuses,
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        order: {
          select: {
            orderNumber: true,
            grandTotal: true,
            paymentMethod: true,
            status: true,
            items: { select: { productNameSnapshot: true, quantity: true, unitSnapshot: true } },
          },
        },
        store: { select: { name: true, phone: true, formattedAddress: true } },
      },
    });
  }

  async getJob(shipperId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: { include: { items: true } },
        store: { select: { name: true, phone: true, formattedAddress: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!delivery) {
      throw new NotFoundException({
        code: 'DELIVERY_NOT_FOUND',
        message: 'Khong tim thay don giao',
      });
    }
    this.assertOwnership(delivery.shipperId, shipperId);
    return delivery;
  }

  /** ASSIGNED -> PICKED_FROM_STORE (shipper da lay hang tu cua hang). */
  async pickedFromStore(shipperId: string, deliveryId: string) {
    return this.advance(
      shipperId,
      deliveryId,
      DeliveryStatus.PICKED_FROM_STORE,
      'Da lay hang tu cua hang',
    );
  }

  /** PICKED_FROM_STORE -> OUT_FOR_DELIVERY. Dong bo order -> OUT_FOR_DELIVERY. */
  async outForDelivery(shipperId: string, deliveryId: string) {
    return this.advance(
      shipperId,
      deliveryId,
      DeliveryStatus.OUT_FOR_DELIVERY,
      'Bat dau giao hang',
    );
  }

  /** OUT_FOR_DELIVERY -> ARRIVED_AT_CUSTOMER. */
  async arrived(shipperId: string, deliveryId: string) {
    return this.advance(
      shipperId,
      deliveryId,
      DeliveryStatus.ARRIVED_AT_CUSTOMER,
      'Da den noi giao',
    );
  }

  /** -> DELIVERED. Commit inventory, order -> DELIVERED -> COMPLETED, thu COD. */
  async delivered(shipperId: string, deliveryId: string, codCollected?: boolean) {
    const delivery = await this.loadOwnedDelivery(shipperId, deliveryId);
    if (!canDeliveryTransition(delivery.status, DeliveryStatus.DELIVERED)) {
      throw new BadRequestException({
        code: 'INVALID_DELIVERY_TRANSITION',
        message: `Khong the chuyen tu ${delivery.status} sang DELIVERED`,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
          codCollected: delivery.codAmount ? !!codCollected : false,
        },
      });
      await tx.deliveryEvent.create({
        data: {
          deliveryId,
          status: DeliveryStatus.DELIVERED,
          note: 'Giao thanh cong',
          actorId: shipperId,
        },
      });
      // Commit inventory
      await this.inventory.commitForOrder(tx, delivery.orderId, shipperId);
      // Order: OUT_FOR_DELIVERY -> DELIVERED -> COMPLETED
      await this.orderTransition(
        tx,
        delivery.orderId,
        OrderStatus.DELIVERED,
        shipperId,
        'Shipper giao thanh cong',
      );
      await this.orderTransition(
        tx,
        delivery.orderId,
        OrderStatus.COMPLETED,
        shipperId,
        'Hoan tat don',
      );
      // COD payment
      if (delivery.codAmount && codCollected) {
        await tx.payment.updateMany({
          where: { orderId: delivery.orderId, method: 'COD' },
          data: { status: PaymentStatus.SUCCESS, paidAt: new Date() },
        });
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { paymentStatus: PaymentStatus.SUCCESS },
        });
      }
    });
    this.events.emit('order.delivered', { orderId: delivery.orderId });
    return this.getJob(shipperId, deliveryId);
  }

  /** -> FAILED. Release inventory, order -> DELIVERY_FAILED. */
  async failed(shipperId: string, deliveryId: string, reason: string) {
    const delivery = await this.loadOwnedDelivery(shipperId, deliveryId);
    if (!canDeliveryTransition(delivery.status, DeliveryStatus.FAILED)) {
      throw new BadRequestException({
        code: 'INVALID_DELIVERY_TRANSITION',
        message: `Khong the chuyen tu ${delivery.status} sang FAILED`,
      });
    }
    if (!reason) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'Can ly do giao that bai',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { id: deliveryId },
        data: { status: DeliveryStatus.FAILED, failureReason: reason },
      });
      await tx.deliveryEvent.create({
        data: {
          deliveryId,
          status: DeliveryStatus.FAILED,
          note: reason,
          actorId: shipperId,
        },
      });
      // Release ton (don khong giao duoc)
      await this.inventory.releaseForOrder(tx, delivery.orderId, shipperId);
      await this.orderTransition(
        tx,
        delivery.orderId,
        OrderStatus.DELIVERY_FAILED,
        shipperId,
        `Giao that bai: ${reason}`,
      );
      await this.audit.log(
        {
          action: 'DELIVERY_FAILED',
          actorId: shipperId,
          targetType: 'Delivery',
          targetId: deliveryId,
          storeId: delivery.storeId,
          metadata: { reason, orderId: delivery.orderId },
        },
        tx,
      );
    });
    this.events.emit('delivery.failed', { deliveryId, reason });
    return this.getJob(shipperId, deliveryId);
  }

  // ---------------- helpers ----------------

  private async advance(
    shipperId: string,
    deliveryId: string,
    to: DeliveryStatus,
    note: string,
  ) {
    const delivery = await this.loadOwnedDelivery(shipperId, deliveryId);
    if (!canDeliveryTransition(delivery.status, to)) {
      throw new BadRequestException({
        code: 'INVALID_DELIVERY_TRANSITION',
        message: `Khong the chuyen tu ${delivery.status} sang ${to}`,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.DeliveryUpdateInput = { status: to };
      if (to === DeliveryStatus.PICKED_FROM_STORE) data.pickedAt = new Date();
      await tx.delivery.update({ where: { id: deliveryId }, data });
      await tx.deliveryEvent.create({
        data: { deliveryId, status: to, note, actorId: shipperId },
      });
      // Dong bo order
      if (to === DeliveryStatus.OUT_FOR_DELIVERY) {
        await this.orderTransition(
          tx,
          delivery.orderId,
          OrderStatus.OUT_FOR_DELIVERY,
          shipperId,
          'Shipper dang giao',
        );
      }
    });
    this.events.emit('delivery.status_changed', { deliveryId, status: to });
    return this.getJob(shipperId, deliveryId);
  }

  private async orderTransition(
    tx: Prisma.TransactionClient,
    orderId: string,
    to: OrderStatus,
    actorId: string,
    reason: string,
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    if (!canTransition(order.status, to)) return; // skip neu khong hop le
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: to, actorId, reason },
    });
  }

  private async loadOwnedDelivery(shipperId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) {
      throw new NotFoundException({
        code: 'DELIVERY_NOT_FOUND',
        message: 'Khong tim thay don giao',
      });
    }
    this.assertOwnership(delivery.shipperId, shipperId);
    return delivery;
  }

  private assertOwnership(deliveryShipperId: string, shipperId: string) {
    if (deliveryShipperId !== shipperId) {
      throw new ForbiddenException({
        code: 'DELIVERY_ACCESS_DENIED',
        message: 'Don giao nay khong duoc gan cho ban',
      });
    }
  }
}
