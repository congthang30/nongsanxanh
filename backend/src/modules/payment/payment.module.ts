import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { VnpayService } from './vnpay.service';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [ConfigModule, OrdersModule, InventoryModule],
  controllers: [PaymentController],
  providers: [PaymentService, VnpayService],
  exports: [PaymentService, VnpayService],
})
export class PaymentModule {}
