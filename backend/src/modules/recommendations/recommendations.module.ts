import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { CoPurchaseService } from './co-purchase.service';

@Module({
  imports: [InventoryModule],
  providers: [CoPurchaseService],
  exports: [CoPurchaseService],
})
export class RecommendationsModule {}
