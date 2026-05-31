import { Module } from '@nestjs/common';
import { ShipperController } from './shipper.controller';
import { ShipperService } from './shipper.service';
import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';
import { ShippingQuoteService } from './shipping-quote.service';
import { InventoryModule } from '../inventory/inventory.module';

/**
 * Shipping module cho mo hinh chuoi cua hang.
 * - GeoService/ShippingQuoteService: tinh khoang cach + phi ship tu store.
 * - ShipperService: shipper jobs (gan truc tiep, khong offer).
 * KHONG con DispatchService / Shipment / offers.
 */
@Module({
  imports: [InventoryModule],
  controllers: [ShipperController, GeoController],
  providers: [ShipperService, GeoService, ShippingQuoteService],
  exports: [GeoService, ShippingQuoteService, ShipperService],
})
export class ShippingModule {}
