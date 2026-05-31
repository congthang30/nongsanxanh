import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { CancelOrderDto, CreateOrderDto, ReturnRequestDto } from './dto/orders.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.ordersService.createOrder(user.id, dto, sessionId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.ordersService.listMyOrders(user.id);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.getOrderForUser(user.id, id);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(user.id, id, dto.reason);
  }

  @Post(':id/return')
  requestReturn(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReturnRequestDto,
  ) {
    return this.ordersService.requestReturn(user.id, id, dto.items, dto.reason);
  }
}
