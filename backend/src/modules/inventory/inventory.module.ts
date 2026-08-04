import { Module } from '@nestjs/common';
import { StoreInventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [CampaignsModule],
  controllers: [InventoryController],
  providers: [StoreInventoryService],
  exports: [StoreInventoryService],
})
export class InventoryModule {}
