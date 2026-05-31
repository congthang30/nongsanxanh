import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationService } from './notification.service';

/**
 * Notification matrix cho mo hinh chuoi cua hang.
 *
 * Events:
 *   - order.created / order.placed / order.cancelled / order.status_changed
 *   - order.packed / order.delivered / order.reassigned
 *   - delivery.failed / delivery.status_changed
 *   - return.requested / return.approved
 *   - support.ticket_created / support.reply
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  private vnd(n: number) {
    return `${n.toLocaleString('vi-VN')}d`;
  }

  private async loadOrder(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, store: true },
    });
  }

  /** Lay userId cua staff cua mot store theo role(s). */
  private async storeStaffIds(
    storeId: string,
    roles?: ('STORE_MANAGER' | 'STORE_STAFF' | 'WAREHOUSE_STAFF' | 'SHIPPER')[],
  ): Promise<string[]> {
    const members = await this.prisma.storeStaff.findMany({
      where: {
        storeId,
        status: 'ACTIVE',
        ...(roles ? { role: { in: roles } } : {}),
      },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // ============================================================
  // ORDER FLOW
  // ============================================================

  @OnEvent('order.created')
  async onOrderCreated(payload: { orderId: string }) {
    const order = await this.loadOrder(payload.orderId);
    if (!order) return;
    await this.notification.notify({
      userId: order.userId,
      type: 'ORDER_CREATED',
      title: 'Dat hang thanh cong',
      body: `Don ${order.orderNumber} da duoc tao. Tong tien: ${this.vnd(order.grandTotal)}.`,
      email: order.user.email,
      data: { orderId: order.id, orderNumber: order.orderNumber },
    });
  }

  /** Don da PLACED (COD ngay, VNPay sau khi tra) -> bao staff cua hang co don moi. */
  @OnEvent('order.placed')
  async onOrderPlaced(payload: { orderId: string; storeId?: string }) {
    const order = await this.loadOrder(payload.orderId);
    if (!order) return;
    const staff = await this.storeStaffIds(order.storeId, [
      'STORE_MANAGER',
      'STORE_STAFF',
    ]);
    if (staff.length > 0) {
      await this.notification.notifyUsers(staff, {
        type: 'STORE_NEW_ORDER',
        title: 'Co don moi can xac nhan',
        body: `Don ${order.orderNumber} vua duoc gan cho cua hang. Vui long xac nhan.`,
        data: { orderId: order.id, storeId: order.storeId },
      });
    }
  }

  @OnEvent('order.cancelled')
  async onCancelled(payload: { orderId: string }) {
    const order = await this.loadOrder(payload.orderId);
    if (!order) return;
    await this.notification.notify({
      userId: order.userId,
      type: 'ORDER_CANCELLED',
      title: 'Don hang da huy',
      body: `Don ${order.orderNumber} da duoc huy.`,
      email: order.user.email,
      data: { orderId: order.id },
    });
  }

  /** Don da dong goi -> bao shipper chinh cua store chuan bi lay hang. */
  @OnEvent('order.packed')
  async onPacked(payload: { orderId: string }) {
    const order = await this.loadOrder(payload.orderId);
    if (!order) return;
    if (order.shipperId) {
      await this.notification.notifyUsers([order.shipperId], {
        type: 'ORDER_PACKED',
        title: 'Don san sang lay hang',
        body: `Don ${order.orderNumber} da dong goi xong tai cua hang.`,
        data: { orderId: order.id },
      });
    }
  }

  @OnEvent('order.delivered')
  async onDelivered(payload: { orderId: string }) {
    const order = await this.loadOrder(payload.orderId);
    if (!order) return;
    await this.notification.notify({
      userId: order.userId,
      type: 'ORDER_DELIVERED',
      title: 'Don hang da giao',
      body: `Don ${order.orderNumber} da giao thanh cong. Hay danh gia san pham.`,
      email: order.user.email,
      data: { orderId: order.id },
    });
  }

  @OnEvent('delivery.status_changed')
  async onDeliveryStatus(payload: { deliveryId: string; status: string }) {
    if (payload.status !== 'OUT_FOR_DELIVERY') return;
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: payload.deliveryId },
      include: { order: { include: { user: true } } },
    });
    if (!delivery) return;
    await this.notification.notify({
      userId: delivery.order.userId,
      type: 'OUT_FOR_DELIVERY',
      title: 'Don dang duoc giao',
      body: `Don ${delivery.order.orderNumber} dang tren duong giao den ban.`,
      email: delivery.order.user.email,
      data: { orderId: delivery.orderId },
    });
  }

  @OnEvent('delivery.failed')
  async onDeliveryFailed(payload: { deliveryId: string; reason?: string }) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: payload.deliveryId },
      include: { order: { include: { user: true } } },
    });
    if (!delivery) return;
    const reason = payload.reason ? ` Ly do: ${payload.reason}.` : '';
    await this.notification.notify({
      userId: delivery.order.userId,
      type: 'DELIVERY_FAILED',
      title: 'Giao hang that bai',
      body: `Don ${delivery.order.orderNumber} giao that bai.${reason}`,
      email: delivery.order.user.email,
      data: { orderId: delivery.orderId },
    });
    // Bao manager cua store xu ly
    const managers = await this.storeStaffIds(delivery.storeId, [
      'STORE_MANAGER',
    ]);
    if (managers.length > 0) {
      await this.notification.notifyUsers(managers, {
        type: 'DELIVERY_FAILED_STORE',
        title: 'Don giao that bai (can xu ly)',
        body: `Don ${delivery.order.orderNumber} giao that bai.${reason}`,
        data: { orderId: delivery.orderId },
      });
    }
  }

  @OnEvent('order.reassigned')
  async onReassigned(payload: { orderId: string; newStoreId: string }) {
    const staff = await this.storeStaffIds(payload.newStoreId, [
      'STORE_MANAGER',
      'STORE_STAFF',
    ]);
    if (staff.length > 0) {
      const order = await this.loadOrder(payload.orderId);
      await this.notification.notifyUsers(staff, {
        type: 'ORDER_REASSIGNED',
        title: 'Don duoc chuyen den cua hang',
        body: `Don ${order?.orderNumber ?? payload.orderId} vua duoc admin chuyen den cua hang cua ban.`,
        data: { orderId: payload.orderId },
      });
    }
  }

  // ============================================================
  // RETURN / SUPPORT
  // ============================================================

  @OnEvent('return.requested')
  async onReturnRequested(payload: { orderId: string; returnId: string }) {
    const order = await this.loadOrder(payload.orderId);
    if (!order) return;
    const managers = await this.storeStaffIds(order.storeId, ['STORE_MANAGER']);
    await this.notification.notifyUsers(managers, {
      type: 'RETURN_REQUESTED',
      title: 'Yeu cau tra hang moi',
      body: `Khach yeu cau tra hang cho don ${order.orderNumber}.`,
      data: { orderId: order.id, returnId: payload.returnId },
    });
    await this.notification.notifyRole('ADMIN', {
      type: 'RETURN_REQUESTED',
      title: 'Yeu cau tra hang moi',
      body: `Don ${order.orderNumber} co yeu cau tra hang.`,
      data: { orderId: order.id, returnId: payload.returnId },
    });
  }

  @OnEvent('support.ticket_created')
  async onTicketCreated(payload: {
    ticketId: string;
    subject?: string;
    priority?: string;
  }) {
    await this.notification.notifyRole('ADMIN', {
      type: 'TICKET_CREATED',
      title: 'Ticket ho tro moi',
      body: `Ticket moi: ${payload.subject ?? 'Khong tieu de'}.`,
      data: { ticketId: payload.ticketId },
      sendEmail: payload.priority === 'HIGH',
    });
  }

  @OnEvent('support.reply')
  async onTicketReply(payload: {
    ticketId: string;
    toUserId: string;
    bySupport: boolean;
  }) {
    if (!payload.bySupport) return;
    await this.notification.notifyUsers([payload.toUserId], {
      type: 'TICKET_REPLY',
      title: 'Phan hoi tu ho tro',
      body: 'Bo phan ho tro vua phan hoi ticket cua ban.',
      data: { ticketId: payload.ticketId },
      sendEmail: true,
    });
  }
}
