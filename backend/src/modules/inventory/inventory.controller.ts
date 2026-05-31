import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StoreInventoryService } from './inventory.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: StoreInventoryService) {}

  /** Ton kha dung cua variant tai mot cua hang cu the. */
  @Public()
  @Get('stores/:storeId/variants/:variantId')
  async availableInStore(
    @Param('storeId') storeId: string,
    @Param('variantId') variantId: string,
  ) {
    return {
      storeId,
      variantId,
      available: await this.inventoryService.getAvailableInStore(
        storeId,
        variantId,
      ),
    };
  }

  @Public()
  @Get('stores/:storeId')
  async storeAvailability(
    @Param('storeId') storeId: string,
    @Query('variantIds') variantIds?: string,
  ) {
    const ids = (variantIds ?? '').split(',').filter(Boolean);
    const map = await this.inventoryService.getAvailabilityMap(storeId, ids);
    return Object.fromEntries(map);
  }
}
