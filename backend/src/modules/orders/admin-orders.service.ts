import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';

/**
 * Quan ly don hang phia admin (toan he thong): xem moi don, reassign store,
 * refund. Day la cac thao tac ngoai le, deu duoc audit log.
 */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  listAllOrders(filter?: { status?: string; storeId?: string }) {
    return this.prisma.order.findMany({
      where: {
        ...(filter?.status ? { status: filter.status as OrderStatus } : {}),
        ...(filter?.storeId ? { storeId: filter.storeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        user: { include: { profile: true } },
        delivery: { select: { status: true, shipperId: true } },
        store: { select: { id: true, name: true, code: true } },
      },
      take: 300,
    });
  }

  async getOrderAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        payments: true,
        delivery: { include: { events: { orderBy: { createdAt: 'asc' } } } },
        user: { include: { profile: true } },
        store: true,
      },
    });
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }
    return order;
  }

  /**
   * Reassign don sang store khac (ngoai le). Release ton store cu, reserve store moi,
   * reassign delivery sang shipper chinh store moi.
   */
  async reassignStore(
    orderId: string,
    newStoreId: string,
    actorId: string,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, delivery: true },
    });
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }
    if (order.storeId === newStoreId) {
      throw new BadRequestException({
        code: 'SAME_STORE',
        message: 'Don da thuoc cua hang nay',
      });
    }
    const reassignable: OrderStatus[] = [
      OrderStatus.PLACED,
      OrderStatus.STORE_CONFIRMED,
    ];
    if (!reassignable.includes(order.status)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_REASSIGNABLE',
        message: 'Chi reassign duoc don chua soan hang',
      });
    }
    const newStore = await this.prisma.store.findUnique({
      where: { id: newStoreId },
    });
    if (!newStore || newStore.status !== 'ACTIVE' || !newStore.primaryShipperId) {
      throw new BadRequestException({
        code: 'STORE_NOT_AVAILABLE',
        message: 'Cua hang moi khong hop le hoac chua co shipper chinh',
      });
    }

    const oldStoreId = order.storeId;
    await this.prisma.$transaction(async (tx) => {
      // Release ton store cu
      await this.inventory.releaseForOrder(tx, orderId, actorId);
      // Reserve ton store moi
      await this.inventory.reserveForOrder(
        tx,
        newStoreId,
        orderId,
        order.items.map((i) => ({
          variantId: i.variantId,
          quantity: Number(i.quantity),
        })),
        actorId,
      );
      // Cap nhat order
      await tx.order.update({
        where: { id: orderId },
        data: {
          storeId: newStoreId,
          shipperId: newStore.primaryShipperId,
          assignmentReason: 'ADMIN_REASSIGNED',
        },
      });
      // Reassign delivery
      if (order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data: {
            storeId: newStoreId,
            shipperId: newStore.primaryShipperId!,
            status: DeliveryStatus.ASSIGNED,
            pickupName: newStore.name,
            pickupAddress: newStore.formattedAddress ?? newStore.addressLine,
            pickupLat: newStore.lat,
            pickupLng: newStore.lng,
            events: {
              create: {
                status: DeliveryStatus.ASSIGNED,
                note: `Reassign sang ${newStore.name}`,
                actorId,
              },
            },
          },
        });
      }
      await this.audit.log(
        {
          action: 'ORDER_STORE_REASSIGNED',
          actorId,
          targetType: 'Order',
          targetId: orderId,
          storeId: newStoreId,
          metadata: { fromStoreId: oldStoreId, toStoreId: newStoreId, reason },
        },
        tx,
      );
    });
    this.events.emit('order.reassigned', { orderId, newStoreId });
    return this.getOrderAdmin(orderId);
  }

  /** Hoan tien don (admin). */
  async refundOrder(orderId: string, actorId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Khong tim thay don hang',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const payment = order.payments.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];
      if (payment) {
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            orderId,
            amount: order.grandTotal,
            status: 'PROCESSED',
            reason: reason ?? 'Admin hoan tien',
            processedAt: new Date(),
          },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      });
      await this.audit.log(
        {
          action: 'ORDER_REFUND',
          actorId,
          targetType: 'Order',
          targetId: orderId,
          storeId: order.storeId,
          metadata: { amount: order.grandTotal, reason },
        },
        tx,
      );
    });
    return this.getOrderAdmin(orderId);
  }

  listReturns(status?: string) {
    return this.prisma.returnRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { orderItem: true } },
        order: {
          select: { orderNumber: true, grandTotal: true, userId: true, storeId: true },
        },
      },
      take: 200,
    });
  }
}
