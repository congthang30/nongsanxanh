import { Module } from '@nestjs/common';
import { CoPurchaseService } from './co-purchase.service';

@Module({
  providers: [CoPurchaseService],
  exports: [CoPurchaseService],
})
export class RecommendationsModule {}
