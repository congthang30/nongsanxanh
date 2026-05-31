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
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  AddStaffDto,
  AssignManagerDto,
  AssignShipperDto,
  CreateServiceAreaDto,
  CreateStoreDto,
  SetUserRolesDto,
  UpdateStoreDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly catalog: CatalogService,
  ) {}

  // ---- Dashboard ----
  @Get('dashboard/summary')
  summary() {
    return this.admin.summary();
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

  // ---- Users / roles ----
  @Get('users')
  users(@Query('role') role?: string) {
    return this.admin.listUsers(role);
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

  // ---- Reports ----
  @Get('reports/revenue')
  revenueReport(@Query('days') days?: string) {
    return this.admin.revenueReport(days ? Number(days) : 30);
  }

  @Get('reports/stores')
  storeReport() {
    return this.admin.storeReport();
  }

  // ---- Audit ----
  @Get('audit-logs')
  auditLogs(@Query('action') action?: string) {
    return this.admin.listAuditLogs(action);
  }
}
