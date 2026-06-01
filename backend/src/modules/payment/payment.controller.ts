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
import { PaymentService, VnpayCallbackResult } from './payment.service';
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

  /** Return URL: nguoi dung redirect ve, tra ket qua cho FE hien thi. */
  @Public()
  @Get('payments/vnpay/return')
  vnpayReturn(@Query() query: Record<string, string>) {
    return this.paymentService.handleVnpayCallback(query);
  }

  /**
   * IPN (server-to-server). VNPay yeu cau response dang { RspCode, Message }.
   * Tra dung format de VNPay khong retry lien tuc (P2-08).
   */
  @Public()
  @Get('payments/vnpay/ipn')
  async vnpayIpn(@Query() query: Record<string, string>) {
    try {
      const result: VnpayCallbackResult =
        await this.paymentService.handleVnpayCallback(query);
      if (result.amountMismatch) {
        return { RspCode: '04', Message: 'Invalid amount' };
      }
      // Da xu ly truoc do hoac xu ly thanh cong deu tra 00 de VNPay dung retry.
      return { RspCode: '00', Message: 'Confirm Success' };
    } catch (e) {
      // Sai chu ky / khong tim thay don -> tra ma loi tuong ung cho VNPay.
      const code = (e as { response?: { code?: string } })?.response?.code;
      if (code === 'INVALID_SIGNATURE') {
        return { RspCode: '97', Message: 'Invalid signature' };
      }
      if (code === 'ORDER_NOT_FOUND') {
        return { RspCode: '01', Message: 'Order not found' };
      }
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }
}
