import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * P0-03: chay dinh ky huy cac don VNPAY PENDING_PAYMENT qua han de release ton.
 *
 * Dung setInterval thay vi @nestjs/schedule (chua cai trong stack) de tranh
 * them dependency. Interval duoc dang ky o onModuleInit va don dep o onDestroy.
 * An toan voi nhieu instance: markPaymentFailed idempotent qua state machine.
 */
@Injectable()
export class PaymentMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentMaintenanceService.name);
  private timer?: ReturnType<typeof setInterval>;

  private readonly INTERVAL_MS = 5 * 60 * 1000; // 5 phut
  private readonly MAX_AGE_MINUTES = 30; // don PENDING qua 30' -> huy

  constructor(private readonly orders: OrdersService) {}

  onModuleInit() {
    // Khong chay trong moi truong test de tranh treo jest.
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.sweep();
    }, this.INTERVAL_MS);
    // Cho phep process thoat ma khong cho interval (khong giu event loop song).
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    try {
      const expired = await this.orders.expireStalePendingPayments(
        this.MAX_AGE_MINUTES,
      );
      if (expired > 0) {
        this.logger.log(`Da huy ${expired} don VNPAY qua han thanh toan`);
      }
    } catch (e) {
      this.logger.warn(`sweep that bai: ${(e as Error).message}`);
    }
  }
}
