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

  /**
   * ASSIGNED -> PICKED_FROM_STORE (shipper da lay hang tu cua hang).
   * Guard: chi cho lay hang khi don da READY_FOR_DELIVERY (cua hang da dong goi
   * + danh dau san sang giao). Tranh shipper "nhay" buoc khi don con dang soan
   * -> dan toi desync order/delivery.
   */
  async pickedFromStore(shipperId: string, deliveryId: string) {
    const delivery = await this.loadOwnedDelivery(shipperId, deliveryId);
    const order = await this.prisma.order.findUnique({
      where: { id: delivery.orderId },
      select: { status: true },
    });
    if (order && order.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException({
        code: 'ORDER_NOT_READY',
        message:
          'Don chua san sang giao. Cua hang can dong goi va danh dau san sang giao truoc khi shipper lay hang.',
      });
    }
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

  /**
   * -> DELIVERED. Commit inventory, order -> DELIVERED.
   *   - COD + da thu tien: payment SUCCESS, order -> COMPLETED.
   *   - COD + CHUA thu tien: giu order o DELIVERED (chua COMPLETED), payment van
   *     PENDING, ghi audit de quan ly doi soat sau. Khong "hoan tat" don chua thu tien.
   *   - Tra truoc (online): order -> COMPLETED (payment da SUCCESS tu callback).
   */
  async delivered(shipperId: string, deliveryId: string, codCollected?: boolean) {
    const delivery = await this.loadOwnedDelivery(shipperId, deliveryId);
    if (!canDeliveryTransition(delivery.status, DeliveryStatus.DELIVERED)) {
      throw new BadRequestException({
        code: 'INVALID_DELIVERY_TRANSITION',
        message: `Khong the chuyen tu ${delivery.status} sang DELIVERED`,
      });
    }
    const isCod = !!delivery.codAmount;
    const codCollectedFinal = isCod ? !!codCollected : false;
    await this.prisma.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
          codCollected: codCollectedFinal,
        },
      });
      await tx.deliveryEvent.create({
        data: {
          deliveryId,
          status: DeliveryStatus.DELIVERED,
          note: isCod && !codCollectedFinal
            ? 'Giao thanh cong - CHUA thu COD (cho doi soat)'
            : 'Giao thanh cong',
          actorId: shipperId,
        },
      });
      // Commit inventory (hang da giao cho khach)
      await this.inventory.commitForOrder(tx, delivery.orderId, shipperId);
      // Order: -> DELIVERED truoc
      await this.orderTransition(
        tx,
        delivery.orderId,
        OrderStatus.DELIVERED,
        shipperId,
        'Shipper giao thanh cong',
      );

      if (isCod && !codCollectedFinal) {
        // Ngoai le: da giao nhung chua thu duoc tien. Khong COMPLETED, khong
        // danh dau payment SUCCESS. Quan ly/admin doi soat sau.
        await this.audit.log(
          {
            action: 'COD_NOT_COLLECTED',
            actorId: shipperId,
            targetType: 'Delivery',
            targetId: deliveryId,
            storeId: delivery.storeId,
            metadata: {
              orderId: delivery.orderId,
              codAmount: delivery.codAmount,
            },
          },
          tx,
        );
      } else {
        // COD da thu HOAC tra truoc online -> hoan tat don.
        if (isCod && codCollectedFinal) {
          await tx.payment.updateMany({
            where: { orderId: delivery.orderId, method: 'COD' },
            data: { status: PaymentStatus.SUCCESS, paidAt: new Date() },
          });
          await tx.order.update({
            where: { id: delivery.orderId },
            data: { paymentStatus: PaymentStatus.SUCCESS },
          });
        }
        await this.orderTransition(
          tx,
          delivery.orderId,
          OrderStatus.COMPLETED,
          shipperId,
          'Hoan tat don',
        );
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
    if (!order) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang lien ket voi don giao',
      });
    }
    // Khong nuot loi am tham: neu transition khong hop le -> bao loi de phat hien
    // desync giua order va delivery state thay vi de don "ket" trang thai cu.
    if (!canTransition(order.status, to)) {
      throw new BadRequestException({
        code: 'ORDER_DELIVERY_DESYNC',
        message: `Trang thai don (${order.status}) khong cho phep chuyen sang ${to}. Vui long kiem tra lai quy trinh xu ly don.`,
      });
    }
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
