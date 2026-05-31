import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FulfillmentService } from '../orders/fulfillment.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

/**
 * Store Staff console - nhan vien ban hang cua cua hang.
 * Xem don moi, xac nhan don, chuyen sang soan hang. Scope theo store cua minh.
 */
@ApiTags('store-staff')
@ApiBearerAuth()
@Roles(ROLE.STORE_STAFF, ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('store/orders')
export class StoreStaffController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.fulfillment.listStoreOrders(user, status);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fulfillment.getStoreOrder(user, id);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fulfillment.confirmOrder(user, id);
  }

  @Post(':id/start-picking')
  startPicking(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fulfillment.startPicking(user, id);
  }

  @Post(':id/cancel-request')
  cancelRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.fulfillment.cancelByStore(user, id, body.reason ?? 'Store huy don');
  }
}
