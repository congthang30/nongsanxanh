import { Module } from '@nestjs/common';
import { StoreInventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  controllers: [InventoryController],
  providers: [StoreInventoryService],
  exports: [StoreInventoryService],
})
export class InventoryModule {}
