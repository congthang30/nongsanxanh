import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { CreateTicketDto, ReplyTicketDto, SetTicketStatusDto } from './dto/support.dto';

@ApiTags('support')
@ApiBearerAuth()
@Controller()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ---- Customer ----
  @Post('support/tickets')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(user.id, dto);
  }

  @Get('support/tickets')
  myTickets(@CurrentUser() user: AuthUser) {
    return this.supportService.listMyTickets(user.id);
  }

  @Get('support/tickets/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    // Admin/Support co the xem bat ky; customer chi xem cua minh
    const isStaff = user.roles.some((r) =>
      [ROLE.SUPPORT, ROLE.ADMIN, ROLE.SUPER_ADMIN].includes(r as never),
    );
    return this.supportService.getTicket(id, isStaff ? undefined : user.id);
  }

  @Post('support/tickets/:id/reply')
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    const isStaff = user.roles.some((r) =>
      [ROLE.SUPPORT, ROLE.ADMIN, ROLE.SUPER_ADMIN].includes(r as never),
    );
    return this.supportService.reply(id, user.id, isStaff ? 'SUPPORT' : 'CUSTOMER', dto);
  }

  // ---- Support staff ----
  @Roles(ROLE.SUPPORT, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Get('admin/support/tickets')
  listAll(@Query('status') status?: string) {
    return this.supportService.listAll(status);
  }

  @Roles(ROLE.SUPPORT, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Patch('admin/support/tickets/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetTicketStatusDto) {
    return this.supportService.setStatus(id, dto.status, dto.assignedTo);
  }
}
