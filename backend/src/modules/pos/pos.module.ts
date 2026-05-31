import { Module } from '@nestjs/common';
import { POSController } from './pos.controller';
import { AdminPOSController } from './admin-pos.controller';
import { POSSaleService } from './pos-sale.service';
import { CashierShiftService } from './cashier-shift.service';
import { BarcodeService } from './barcode.service';
import { POSReturnService } from './pos-return.service';
import { POSReportService } from './pos-report.service';
import { InventoryModule } from '../inventory/inventory.module';
import { StoreModule } from '../store/store.module';
import { PaymentModule } from '../payment/payment.module';

/**
 * POS module - ban hang tai quay (in-store checkout) cho chuoi cua hang.
 * Phu thuoc InventoryModule (tru ton POS) + StoreModule (scope theo store)
 * + PaymentModule (sinh URL thanh toan VNPay cho QR).
 */
@Module({
  imports: [InventoryModule, StoreModule, PaymentModule],
  controllers: [POSController, AdminPOSController],
  providers: [
    POSSaleService,
    CashierShiftService,
    BarcodeService,
    POSReturnService,
    POSReportService,
  ],
  exports: [BarcodeService, POSSaleService],
})
export class POSModule {}
