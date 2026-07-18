import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { InventoryModule } from '../inventory/inventory.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule, InventoryModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
