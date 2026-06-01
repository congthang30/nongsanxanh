import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOrdersService } from './admin-orders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { ReassignStoreDto, ProcessReturnDto } from './dto/orders.dto';

@ApiTags('admin-orders')
@ApiBearerAuth()
@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly adminOrders: AdminOrdersService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.adminOrders.listAllOrders({ status, storeId });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.adminOrders.getOrderAdmin(id);
  }

  @Post(':id/reassign-store')
  reassignStore(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReassignStoreDto,
  ) {
    return this.adminOrders.reassignStore(id, dto.storeId, user.id, dto.reason);
  }

  @Post(':id/refund')
  refund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminOrders.refundOrder(id, user.id, body.reason);
  }

  @Get('returns/list')
  listReturns(@Query('status') status?: string) {
    return this.adminOrders.listReturns(status);
  }

  /** P1-01: Admin duyet/tu choi yeu cau tra hang online (restock + refund pending). */
  @Post('returns/:id/process')
  processReturn(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ProcessReturnDto & { reason?: string },
  ) {
    return this.adminOrders.processReturn(id, dto.approve, user.id, dto.reason);
  }
}
