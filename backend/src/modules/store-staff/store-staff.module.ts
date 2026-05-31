import { Module } from '@nestjs/common';
import { StoreStaffController } from './store-staff.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [StoreStaffController],
})
export class StoreStaffModule {}
