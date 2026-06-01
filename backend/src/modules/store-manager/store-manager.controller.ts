import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StoreManagerService } from './store-manager.service';
import { FulfillmentService } from '../orders/fulfillment.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

/**
 * Store Manager console - quan ly cua hang cua chinh minh.
 */
@ApiTags('store-manager')
@ApiBearerAuth()
@Roles(ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('store-manager')
export class StoreManagerController {
  constructor(
    private readonly manager: StoreManagerService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.manager.dashboard(user);
  }

  @Get('store')
  store(@CurrentUser() user: AuthUser) {
    return this.manager.getStore(user);
  }

  @Patch('store/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Body() body: { status: string },
  ) {
    return this.manager.updateStoreStatus(user, body.status);
  }

  // ---- Orders (full lifecycle control) ----

  @Get('orders')
  orders(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.fulfillment.listStoreOrders(user, status);
  }

  @Get('orders/:id')
  orderDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fulfillment.getStoreOrder(user, id);
  }

  @Post('orders/:id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fulfillment.confirmOrder(user, id);
  }

  @Post('orders/:id/ready-for-delivery')
  ready(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fulfillment.readyForDelivery(user, id);
  }

  @Post('orders/:id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.fulfillment.cancelByStore(user, id, body.reason ?? 'Manager huy don');
  }

  /** Manager giao lai don da FAILED cho shipper chinh. */
  @Post('orders/:id/reassign-delivery')
  reassignDelivery(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.manager.reassignDelivery(user, id);
  }

  /** Manager huy don voi hoan kho (vd khach bom hang sau FAILED). */
  @Post('orders/:id/cancel-restock')
  cancelRestock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.manager.cancelWithRestock(user, id, body.reason ?? 'Manager huy don, hoan kho');
  }

  /** Manager xac nhan da thu tien COD cho don da giao (shipper chua thu luc giao). */
  @Post('orders/:id/mark-cod-collected')
  markCodCollected(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.manager.markCodCollected(user, id);
  }

  // ---- Staff ----

  @Get('staff')
  staff(@CurrentUser() user: AuthUser) {
    return this.manager.listStaff(user);
  }

  // ---- Inventory ----

  @Get('inventory')
  inventory(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.manager.listInventory(user, q, lowStock === 'true');
  }

  // ---- Reports ----

  @Get('reports')
  reports(@CurrentUser() user: AuthUser) {
    return this.manager.reports(user);
  }
}
