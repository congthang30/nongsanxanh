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
import { POSSaleService } from './pos-sale.service';
import { CashierShiftService } from './cashier-shift.service';
import { BarcodeService } from './barcode.service';
import { POSReturnService } from './pos-return.service';
import { POSReportService } from './pos-report.service';
import { StoreScopeService } from '../store/store-scope.service';
import {
  CloseShiftDto,
  CreateReturnDto,
  CreateSaleDto,
  OpenShiftDto,
  PaySaleDto,
  ScanItemDto,
  UpdateItemDto,
  VoidSaleDto,
} from './dto/pos.dto';

/**
 * POS terminal cho thu ngan/quan ly tai cua hang.
 * Tat ca thao tac scope theo store cua nhan vien (chong IDOR).
 * Warehouse staff KHONG co quyen POS mac dinh.
 */
@ApiTags('pos')
@ApiBearerAuth()
@Roles(ROLE.STORE_STAFF, ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('pos')
export class POSController {
  constructor(
    private readonly sales: POSSaleService,
    private readonly shifts: CashierShiftService,
    private readonly barcodes: BarcodeService,
    private readonly returns: POSReturnService,
    private readonly reports: POSReportService,
    private readonly scope: StoreScopeService,
  ) {}

  // ---------------- Shifts ----------------

  @Post('shifts/open')
  openShift(@CurrentUser() user: AuthUser, @Body() dto: OpenShiftDto) {
    return this.shifts.openShift(user, dto.openingCash ?? 0, dto.note);
  }

  @Post('shifts/close')
  closeShift(@CurrentUser() user: AuthUser, @Body() dto: CloseShiftDto) {
    return this.shifts.closeShift(user, dto.countedCash, dto.note);
  }

  @Get('shifts/current')
  currentShift(@CurrentUser() user: AuthUser) {
    return this.shifts.getCurrent(user);
  }

  // ---------------- Product lookup / search ----------------

  @Get('products/lookup')
  async lookup(@CurrentUser() user: AuthUser, @Query('barcode') barcode: string) {
    const storeId = await this.shiftStore(user);
    return this.barcodes.lookup(storeId, barcode);
  }

  @Get('products/search')
  async search(@CurrentUser() user: AuthUser, @Query('q') q: string) {
    const storeId = await this.shiftStore(user);
    return this.barcodes.search(storeId, q ?? '');
  }

  // ---------------- Sales ----------------

  @Post('sales')
  createSale(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.sales.createSale(user, dto.customerPhone);
  }

  @Get('sales/held')
  heldSales(@CurrentUser() user: AuthUser) {
    return this.sales.listHeldSales(user);
  }

  @Get('sales/:id')
  getSale(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.getSale(user, id);
  }

  @Post('sales/:id/scan')
  scan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ScanItemDto,
  ) {
    return this.sales.scanItem(user, id, dto.barcode, dto.quantity);
  }

  @Patch('sales/:id/items/:itemId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.sales.updateItem(user, id, itemId, dto.quantity);
  }

  @Delete('sales/:id/items/:itemId')
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.sales.removeItem(user, id, itemId);
  }

  @Post('sales/:id/hold')
  hold(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.hold(user, id);
  }

  @Post('sales/:id/resume')
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.resume(user, id);
  }

  @Post('sales/:id/pay')
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PaySaleDto,
  ) {
    return this.sales.pay(user, id, dto);
  }

  @Post('sales/:id/void')
  voidSale(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VoidSaleDto,
  ) {
    return this.sales.voidSale(user, id, dto.reason, false);
  }

  @Get('sales/:id/receipt')
  receipt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.getReceipt(user, id);
  }

  // ---------------- Manager: void/return/reports ----------------

  @Roles(ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('sales/:id/manager-void')
  managerVoid(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VoidSaleDto,
  ) {
    return this.sales.voidSale(user, id, dto.reason, true);
  }

  @Roles(ROLE.STORE_MANAGER, ROLE.STORE_STAFF, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('returns')
  createReturn(@CurrentUser() user: AuthUser, @Body() dto: CreateReturnDto) {
    return this.returns.createReturn(user, dto);
  }

  @Roles(ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Get('returns')
  listReturns(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.returns.listReturns(user, storeId);
  }

  @Roles(ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('returns/:id/approve')
  approveReturn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.returns.approve(user, id);
  }

  @Roles(ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('returns/:id/complete')
  completeReturn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.returns.complete(user, id);
  }

  @Roles(ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Get('reports/daily')
  dailyReport(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.reports.daily(user, { from, to, storeId });
  }

  @Roles(ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Get('reports/shifts')
  shiftsReport(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.reports.shiftReport(user, { from, to, storeId });
  }

  @Roles(ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Get('sales')
  listSales(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.reports.listSales(user, { from, to, status, storeId });
  }

  /** Store cua nhan vien dang dang nhap (dung cho lookup/search). */
  private shiftStore(user: AuthUser): Promise<string> {
    return this.scope.requireUserStoreId(user.id);
  }
}
