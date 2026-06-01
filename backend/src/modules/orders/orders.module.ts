import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { FulfillmentService } from './fulfillment.service';
import { AdminOrdersService } from './admin-orders.service';
import { PaymentMaintenanceService } from './payment-maintenance.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PromotionModule } from '../promotion/promotion.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [InventoryModule, PromotionModule, ShippingModule, StoreModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [
    OrdersService,
    FulfillmentService,
    AdminOrdersService,
    PaymentMaintenanceService,
  ],
  exports: [OrdersService, FulfillmentService, AdminOrdersService],
})
export class OrdersModule {}
