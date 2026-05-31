import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { BarcodeService } from './barcode.service';
import { POSReportService } from './pos-report.service';
import { CreateBarcodeDto, UpdateBarcodeDto } from './dto/pos.dto';

/**
 * Admin APIs cho POS: quan ly barcode toan he thong + xem hoa don/bao cao
 * toan chuoi. Chi Admin/Super Admin.
 */
@ApiTags('admin-pos')
@ApiBearerAuth()
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('admin')
export class AdminPOSController {
  constructor(
    private readonly barcodes: BarcodeService,
    private readonly reports: POSReportService,
  ) {}

  // ---------------- Barcode management ----------------

  @Get('barcodes')
  listBarcodes(
    @Query('q') q?: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.barcodes.listBarcodes({ q, variantId });
  }

  @Post('products/:variantId/barcodes')
  createBarcode(
    @CurrentUser() user: AuthUser,
    @Param('variantId') variantId: string,
    @Body() dto: CreateBarcodeDto,
  ) {
    return this.barcodes.createBarcode(variantId, dto, user.id);
  }

  @Patch('barcodes/:id')
  updateBarcode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBarcodeDto,
  ) {
    return this.barcodes.updateBarcode(id, dto, user.id);
  }

  @Delete('barcodes/:id')
  deleteBarcode(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.barcodes.deleteBarcode(id, user.id);
  }

  // ---------------- POS sales / reports (toan he thong) ----------------

  @Get('pos/sales')
  listSales(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.reports.listSales(user, { from, to, status, storeId });
  }

  @Get('pos/reports')
  posReports(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.reports.daily(user, { from, to, storeId });
  }
}
