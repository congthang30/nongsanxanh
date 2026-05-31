import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/payment.dto';

@ApiTags('payment')
@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @Post('payments')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    return this.paymentService.createVnpayPayment(user.id, dto.orderId, ip);
  }

  @Public()
  @Get('payments/vnpay/return')
  vnpayReturn(@Query() query: Record<string, string>) {
    return this.paymentService.handleVnpayCallback(query);
  }

  @Public()
  @Get('payments/vnpay/ipn')
  vnpayIpn(@Query() query: Record<string, string>) {
    return this.paymentService.handleVnpayCallback(query);
  }
}
