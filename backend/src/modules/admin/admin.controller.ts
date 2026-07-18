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
import { AdminService } from './admin.service';
import { CatalogService } from '../catalog/catalog.service';
import { CoPurchaseService } from '../recommendations/co-purchase.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  AddStaffDto,
  AdminAdjustStockDto,
  AdminExportStockDto,
  AdminImportStockDto,
  AssignManagerDto,
  AssignShipperDto,
  CreateServiceAreaDto,
  CreateStaffAccountDto,
  CreateStoreDto,
  SetUserRolesDto,
  UpdateStaffAccountDto,
  UpdateStoreDto,
  UpdateStoreStaffDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly catalog: CatalogService,
    private readonly coPurchase: CoPurchaseService,
  ) {}

  // ---- Dashboard ----
  @Get('dashboard/summary')
  summary(@Query('storeId') storeId?: string) {
    return this.admin.summary(storeId);
  }

  // ---- Stores ----
  @Get('stores')
  stores() {
    return this.admin.listStores();
  }

  @Post('stores')
  createStore(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreDto) {
    return this.admin.createStore(dto, user.id);
  }

  @Get('stores/:id')
  storeDetail(@Param('id') id: string) {
    return this.admin.getStore(id);
  }

  @Patch('stores/:id')
  updateStore(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.admin.updateStore(id, dto, user.id);
  }

  @Delete('stores/:id')
  closeStore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.closeStore(id, user.id);
  }

  // ---- Service areas ----
  @Post('stores/:id/service-areas')
  addServiceArea(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateServiceAreaDto,
  ) {
    return this.admin.addServiceArea(id, dto, user.id);
  }

  @Delete('stores/:id/service-areas/:areaId')
  removeServiceArea(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId') areaId: string,
  ) {
    return this.admin.removeServiceArea(id, areaId, user.id);
  }

  // ---- Assign manager / shipper / staff ----
  @Post('stores/:id/assign-manager')
  assignManager(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignManagerDto,
  ) {
    return this.admin.assignManager(id, dto, user.id);
  }

  @Post('stores/:id/assign-shipper')
  assignShipper(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignShipperDto,
  ) {
    return this.admin.assignShipper(id, dto, user.id);
  }

  @Post('stores/:id/staff')
  addStaff(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddStaffDto,
  ) {
    return this.admin.addStaff(id, dto.userId, dto.role, user.id);
  }

  @Patch('stores/:id/staff/:staffId')
  updateStaff(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStoreStaffDto,
  ) {
    return this.admin.updateStaff(id, staffId, dto, user.id);
  }

  @Delete('stores/:id/staff/:staffId')
  removeStaff(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('staffId') staffId: string,
  ) {
    return this.admin.removeStaff(id, staffId, user.id);
  }

  // ---- Customer accounts ----
  @Get('customers')
  customers(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.admin.listCustomers({ q, status, storeId });
  }

  @Patch('customers/:id/status')
  setCustomerStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'LOCKED' },
  ) {
    return this.admin.setCustomerStatus(id, body.status, user.id);
  }

  // ---- Users / global roles ----
  @Get('users')
  users(@Query('role') role?: string, @Query('storeId') storeId?: string) {
    return this.admin.listUsers({ role, storeId });
  }

  @Patch('users/:id/roles')
  setRoles(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetUserRolesDto,
  ) {
    return this.admin.setUserRoles(id, dto.roles, user.id);
  }

  @Patch('users/:id/status')
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'LOCKED' },
  ) {
    return this.admin.setUserStatus(id, body.status, user.id);
  }

  // ---- Staff accounts / store memberships ----
  @Get('staff')
  staff(@Query('storeId') storeId?: string, @Query('status') status?: string) {
    return this.admin.listStaff({ storeId, status });
  }

  @Post('staff')
  createStaff(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffAccountDto) {
    return this.admin.createStaffAccount(dto, user.id);
  }

  @Patch('staff/:staffId')
  updateStaffAccount(
    @CurrentUser() user: AuthUser,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffAccountDto,
  ) {
    return this.admin.updateStaffAccount(staffId, dto, user.id);
  }

  @Delete('staff/:staffId')
  removeStaffAccount(@CurrentUser() user: AuthUser, @Param('staffId') staffId: string) {
    return this.admin.removeStaffAccount(staffId, user.id);
  }
  // ---- Products (global) ----
  @Get('products')
  products(@Query() query: Record<string, string>) {
    return this.catalog.listProducts({ ...query, includeAll: true } as never);
  }

  @Get('products/:id')
  productDetail(@Param('id') id: string) {
    return this.catalog.getProductAdmin(id);
  }

  @Post('products')
  createProduct(@Body() body: never) {
    return this.catalog.createProduct(body);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: never) {
    return this.catalog.updateProduct(id, body);
  }

  // ---- Inventory by store ----
  @Get('inventory')
  inventory(@Query('storeId') storeId: string) {
    return this.admin.inventoryByStore(storeId);
  }

  @Get('inventory/transactions')
  inventoryTransactions(
    @Query('storeId') storeId: string,
    @Query('variantId') variantId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.inventoryTransactions(storeId, { variantId, type, from, to });
  }

  @Post('inventory/import')
  importStock(@CurrentUser() user: AuthUser, @Body() dto: AdminImportStockDto) {
    return this.admin.importStock(dto.storeId, dto, user.id);
  }

  @Post('inventory/adjust')
  adjustStock(@CurrentUser() user: AuthUser, @Body() dto: AdminAdjustStockDto) {
    return this.admin.adjustStock(dto.storeId, dto, user.id);
  }

  @Post('inventory/export')
  exportStock(@CurrentUser() user: AuthUser, @Body() dto: AdminExportStockDto) {
    return this.admin.exportStock(dto.storeId, dto, user.id);
  }

  // ---- Reports ----
  @Get('reports/revenue')
  revenueReport(@Query('days') days?: string, @Query('storeId') storeId?: string) {
    return this.admin.revenueReport(days ? Number(days) : 30, storeId);
  }

  @Get('reports/stores')
  storeReport(@Query('storeId') storeId?: string) {
    return this.admin.storeReport(storeId);
  }

  /** P1-02: Doi soat doanh thu Order vs Payment vs POS theo khoang ngay. */
  @Get('reports/reconciliation')
  reconciliation(@Query('from') from?: string, @Query('to') to?: string, @Query('storeId') storeId?: string) {
    return this.admin.reconciliation({ from, to, storeId });
  }

  /** P1-04: Don COD da giao nhung chua thu tien (cong no COD). */
  @Get('reports/cod-outstanding')
  codOutstanding(@Query('storeId') storeId?: string) {
    return this.admin.codOutstanding(storeId);
  }

  // ---- Audit ----
  @Get('audit-logs')
  auditLogs(@Query('action') action?: string, @Query('storeId') storeId?: string) {
    return this.admin.listAuditLogs(action, storeId);
  }

  /**
   * Rebuild bang co-purchase (item-item) tu don DELIVERED/COMPLETED.
   * Chay batch — khong chay moi request cart.
   */
  @Post('recommendations/rebuild-co-purchase')
  rebuildCoPurchase() {
    return this.coPurchase.rebuildStats();
  }
}
