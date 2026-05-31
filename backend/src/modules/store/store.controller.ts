import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { ResolveStoreDto } from './dto/store.dto';

/**
 * Customer storefront APIs cho mo hinh chuoi cua hang.
 * Tat ca public (khach an danh van xem duoc), nhung neu co token thi
 * resolve dia chi cua user.
 */
@ApiTags('stores')
@Public()
@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  /** Tim cua hang phuc vu cho dia chi/khu vuc khach. */
  @Post('resolve')
  resolve(@Body() dto: ResolveStoreDto, @CurrentUser() user?: AuthUser) {
    return this.storeService.resolveStore(dto, user?.id);
  }

  /** Chi tiet cong khai cua mot cua hang. */
  @Get(':storeId')
  detail(@Param('storeId') storeId: string) {
    return this.storeService.getStorePublic(storeId);
  }

  /** San pham co the mua tai cua hang. */
  @Get(':storeId/products')
  products(
    @Param('storeId') storeId: string,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storeService.listProductsByStore(storeId, {
      q,
      categoryId,
      sort,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** Chi tiet san pham tai cua hang. */
  @Get(':storeId/products/:slug')
  productDetail(
    @Param('storeId') storeId: string,
    @Param('slug') slug: string,
  ) {
    return this.storeService.getProductByStore(storeId, slug);
  }
}
