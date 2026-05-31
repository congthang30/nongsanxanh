import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { InventoryModule } from '../inventory/inventory.module';
import { StoreModule } from '../store/store.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [InventoryModule, StoreModule, OrdersModule],
  controllers: [WarehouseController],
  providers: [WarehouseService],
})
export class WarehouseModule {}
