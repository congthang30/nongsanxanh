import { Module } from '@nestjs/common';
import { StoreManagerController } from './store-manager.controller';
import { StoreManagerService } from './store-manager.service';
import { StoreModule } from '../store/store.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [StoreModule, InventoryModule, OrdersModule, AuditModule],
  controllers: [StoreManagerController],
  providers: [StoreManagerService],
})
export class StoreManagerModule {}
