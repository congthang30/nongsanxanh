import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  AddCartItemDto,
  CheckoutQuoteDto,
  RevalidateCartDto,
  UpdateCartItemDto,
} from './dto/cart.dto';

/**
 * Cart cho mo hinh chuoi cua hang. Moi gio chi thuoc mot cua hang.
 * Ho tro khach dang nhap (token) va anonymous (X-Session-Id).
 */
@ApiTags('cart')
@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(
    @CurrentUser() user?: AuthUser,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.getCart(user?.id, sessionId);
  }

  @Post('items')
  addItem(
    @Body() dto: AddCartItemDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.addItem(dto, user?.id, sessionId);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.updateItem(id, dto, user?.id, sessionId);
  }

  @Delete('items/:id')
  removeItem(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.removeItem(id, user?.id, sessionId);
  }

  @Post('revalidate')
  revalidate(
    @Body() dto: RevalidateCartDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.revalidate(dto, user?.id, sessionId);
  }

  @Post('checkout/quote')
  quote(
    @Body() dto: CheckoutQuoteDto,
    @CurrentUser() user?: AuthUser,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.checkoutQuote(dto, user?.id, sessionId);
  }
}
