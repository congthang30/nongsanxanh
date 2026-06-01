import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private readonly config: ConfigService,
  ) {}

  private vnd(n: number) {
    return `${n.toLocaleString('vi-VN')}đ`;
  }

  private appUrl(path: string) {
    const baseUrl = this.config.get<string>(
      'PUBLIC_APP_URL',
      this.config.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    );
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }

  private orderAction(orderId: string) {
    return {
      label: 'Xem chi tiết đơn hàng',
      url: this.appUrl(`/orders/${orderId}`),
    };
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
      title:
        order.paymentMethod === 'VNPAY'
          ? 'Đơn hàng đã được tạo'
          : 'Đặt hàng thành công',
      body:
        order.paymentMethod === 'VNPAY'
          ? `Đơn ${order.orderNumber} đã được tạo và đang chờ thanh toán online.\nTổng tiền cần thanh toán: ${this.vnd(order.grandTotal)}.\nCửa hàng phụ trách: ${order.store.name}.`
          : `Chúng tôi đã ghi nhận đơn ${order.orderNumber}.\nTổng tiền: ${this.vnd(order.grandTotal)}.\nCửa hàng phụ trách: ${order.store.name}. Nhân viên sẽ sớm xác nhận và chuẩn bị hàng cho bạn.`,
      email: order.user.email,
      emailAction: this.orderAction(order.id),
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
        title: 'Có đơn mới cần xác nhận',
        body: `Đơn ${order.orderNumber} vừa được hệ thống gán cho cửa hàng ${order.store.name}.\nVui lòng kiểm tra tồn kho, xác nhận đơn và chuyển sang bước chuẩn bị hàng.`,
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
      title: 'Đơn hàng đã được hủy',
      body: `Đơn ${order.orderNumber} đã được hủy.\nNếu bạn đã thanh toán online, hệ thống sẽ xử lý theo quy trình hoàn tiền/đối soát của cửa hàng.`,
      email: order.user.email,
      emailAction: this.orderAction(order.id),
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
        title: 'Đơn đã sẵn sàng lấy hàng',
        body: `Đơn ${order.orderNumber} đã được đóng gói tại ${order.store.name}.\nVui lòng đến cửa hàng lấy hàng và cập nhật trạng thái giao hàng đúng thời điểm.`,
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
      title: 'Đơn hàng đã giao thành công',
      body: `Đơn ${order.orderNumber} đã được giao thành công.\nCảm ơn bạn đã mua hàng tại Nông Sản Xanh. Bạn có thể xem lại đơn hàng và đánh giá sản phẩm khi thuận tiện.`,
      email: order.user.email,
      emailAction: this.orderAction(order.id),
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
      title: 'Đơn hàng đang được giao',
      body: `Đơn ${delivery.order.orderNumber} đang trên đường giao đến bạn.\nVui lòng giữ điện thoại sẵn sàng để shipper có thể liên hệ khi tới nơi.`,
      email: delivery.order.user.email,
      emailAction: this.orderAction(delivery.orderId),
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
    const reason = payload.reason ? ` Lý do: ${payload.reason}.` : '';
    await this.notification.notify({
      userId: delivery.order.userId,
      type: 'DELIVERY_FAILED',
      title: 'Giao hàng chưa thành công',
      body: `Đơn ${delivery.order.orderNumber} chưa giao được.${reason}\nCửa hàng sẽ kiểm tra lại thông tin và liên hệ để xử lý bước tiếp theo.`,
      email: delivery.order.user.email,
      emailAction: this.orderAction(delivery.orderId),
      data: { orderId: delivery.orderId },
    });
    // Bao manager cua store xu ly
    const managers = await this.storeStaffIds(delivery.storeId, [
      'STORE_MANAGER',
    ]);
    if (managers.length > 0) {
      await this.notification.notifyUsers(managers, {
        type: 'DELIVERY_FAILED_STORE',
        title: 'Đơn giao thất bại cần xử lý',
        body: `Đơn ${delivery.order.orderNumber} chưa giao được.${reason}\nVui lòng kiểm tra với shipper và quyết định giao lại, hủy đơn hoặc hoàn hàng về kho.`,
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
        title: 'Đơn được chuyển về cửa hàng',
        body: `Đơn ${order?.orderNumber ?? payload.orderId} vừa được admin chuyển về cửa hàng của bạn.\nVui lòng kiểm tra lại tồn kho và tiếp tục xử lý đơn.`,
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
      title: 'Có yêu cầu trả hàng mới',
      body: `Khách hàng vừa gửi yêu cầu trả hàng cho đơn ${order.orderNumber}.\nVui lòng kiểm tra lý do, tình trạng hàng và xử lý theo chính sách đổi trả.`,
      data: { orderId: order.id, returnId: payload.returnId },
    });
    await this.notification.notifyRole('ADMIN', {
      type: 'RETURN_REQUESTED',
      title: 'Có yêu cầu trả hàng mới',
      body: `Đơn ${order.orderNumber} có yêu cầu trả hàng.\nAdmin cần theo dõi để đảm bảo hoàn tiền, nhập lại kho và audit log được xử lý đúng.`,
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
      title: 'Có ticket hỗ trợ mới',
      body: `Một ticket hỗ trợ mới vừa được tạo.\nChủ đề: ${payload.subject ?? 'Không có tiêu đề'}.\nVui lòng phản hồi sớm nếu ticket có mức ưu tiên cao.`,
      data: { ticketId: payload.ticketId },
      sendEmail: payload.priority === 'HIGH',
      emailAction: {
        label: 'Mở trang hỗ trợ',
        url: this.appUrl('/staff/tickets'),
      },
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
      title: 'Bạn có phản hồi mới từ hỗ trợ',
      body: 'Bộ phận hỗ trợ vừa phản hồi ticket của bạn.\nVui lòng kiểm tra nội dung phản hồi để tiếp tục trao đổi nếu cần.',
      data: { ticketId: payload.ticketId },
      sendEmail: true,
    });
  }
}
