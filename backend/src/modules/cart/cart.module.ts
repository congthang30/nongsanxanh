import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PromotionModule } from '../promotion/promotion.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StoreModule } from '../store/store.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';

@Module({
  imports: [
    PromotionModule,
    InventoryModule,
    ShippingModule,
    StoreModule,
    RecommendationsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
