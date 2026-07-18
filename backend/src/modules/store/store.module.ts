import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { StoreResolverService } from './store-resolver.service';
import { StoreScopeService } from './store-scope.service';
import { StoreContextController } from './store-context.controller';
import { ShippingModule } from '../shipping/shipping.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [ShippingModule, InventoryModule],
  controllers: [StoreController, StoreContextController],
  providers: [StoreService, StoreResolverService, StoreScopeService],
  exports: [StoreResolverService, StoreScopeService, StoreService],
})
export class StoreModule {}
