import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
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
  constructor(
    private readonly paymentService: PaymentService,
    private readonly config: ConfigService,
  ) {}

  @ApiBearerAuth()
  @Post('payments')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    // VNPay chi chap nhan 1 IP; x-forwarded-for co the la "a, b, c".
    const rawIp =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const ip = String(rawIp).split(',')[0].trim();
    return this.paymentService.createVnpayPayment(user.id, dto.orderId, ip);
  }

  /**
   * Return URL (VNPAY_RETURN_URL) — mac dinh backend :3000.
   * - Browser (Accept: text/html): xu ly xong redirect ve FE /payment/vnpay/return.
   * - XHR/API (FE goi lai): tra JSON ket qua.
   */
  @Public()
  @Get('payments/vnpay/return')
  async vnpayReturn(
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.paymentService.handleVnpayCallback(query);

    const accept = String(req.headers.accept ?? '');
    const wantsHtml =
      accept.includes('text/html') && !accept.includes('application/json');

    if (wantsHtml) {
      const appUrl = (
        this.config.get<string>('PUBLIC_APP_URL') ||
        this.config.get<string>('CORS_ORIGIN') ||
        'http://localhost:5173'
      ).replace(/\/$/, '');
      const qs = new URLSearchParams(query).toString();
      return res.redirect(302, `${appUrl}/payment/vnpay/return?${qs}`);
    }

    return result;
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
