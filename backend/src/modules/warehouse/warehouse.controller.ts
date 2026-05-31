import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service';
import { FulfillmentService } from '../orders/fulfillment.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AdjustStockDto, ImportStockDto, MarkPackedDto } from './dto/warehouse.dto';

/**
 * Warehouse Staff console - scope theo cua hang cua nhan vien.
 * Soan hang (pick/pack) + quan ly ton kho cua hang.
 */
@ApiTags('warehouse')
@ApiBearerAuth()
@Roles(ROLE.WAREHOUSE_STAFF, ROLE.STORE_MANAGER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller('warehouse')
export class WarehouseController {
  constructor(
    private readonly warehouse: WarehouseService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  // ---- Soan hang ----

  @Get('orders-to-pick')
  ordersToPick(@CurrentUser() user: AuthUser) {
    return this.fulfillment.listOrdersToPick(user);
  }

  @Get('orders/:id')
  orderDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fulfillment.getStoreOrder(user, id);
  }

  @Post('orders/:id/start-picking')
  startPicking(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fulfillment.startPicking(user, id);
  }

  @Post('orders/:id/packed')
  markPacked(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MarkPackedDto,
  ) {
    return this.fulfillment.markPacked(user, id, dto.pickedItems);
  }

  // ---- Ton kho ----

  @Get('inventory')
  inventory(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.warehouse.listInventory(user, q, lowStock === 'true');
  }

  @Get('low-stock')
  lowStock(@CurrentUser() user: AuthUser) {
    return this.warehouse.listLowStock(user);
  }

  @Get('inventory/transactions')
  transactions(
    @CurrentUser() user: AuthUser,
    @Query('variantId') variantId?: string,
  ) {
    return this.warehouse.listTransactions(user, variantId);
  }

  @Post('inventory/import')
  importStock(@CurrentUser() user: AuthUser, @Body() dto: ImportStockDto) {
    return this.warehouse.importStock(user, dto.variantId, dto.quantity, dto.reason);
  }

  @Post('inventory/adjust')
  adjustStock(@CurrentUser() user: AuthUser, @Body() dto: AdjustStockDto) {
    return this.warehouse.adjustStock(
      user,
      dto.variantId,
      dto.newQuantity,
      dto.reason,
    );
  }
}
