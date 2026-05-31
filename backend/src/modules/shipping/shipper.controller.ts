import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ShipperService } from './shipper.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

/**
 * Shipper jobs - shipper chinh cua cua hang. KHONG con offers/accept/reject.
 * Moi endpoint kiem tra delivery.shipperId == currentUser.id.
 */
@ApiTags('shipper')
@ApiBearerAuth()
@Roles(ROLE.SHIPPER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('shipper')
export class ShipperController {
  constructor(private readonly shipper: ShipperService) {}

  @Get('jobs')
  jobs(
    @CurrentUser() user: AuthUser,
    @Query('scope') scope?: 'active' | 'history',
  ) {
    return this.shipper.listJobs(user.id, scope);
  }

  @Get('jobs/:id')
  job(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipper.getJob(user.id, id);
  }

  @Post('jobs/:id/picked-from-store')
  pickedFromStore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipper.pickedFromStore(user.id, id);
  }

  @Post('jobs/:id/out-for-delivery')
  outForDelivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipper.outForDelivery(user.id, id);
  }

  @Post('jobs/:id/arrived')
  arrived(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipper.arrived(user.id, id);
  }

  @Post('jobs/:id/delivered')
  delivered(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { codCollected?: boolean },
  ) {
    return this.shipper.delivered(user.id, id, body.codCollected);
  }

  @Post('jobs/:id/failed')
  failed(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.shipper.failed(user.id, id, body.reason);
  }
}
