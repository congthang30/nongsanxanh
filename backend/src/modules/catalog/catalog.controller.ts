import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { Public } from '../../common/decorators/public.decorator';
import { ProductQueryDto } from './dto/catalog.dto';

/**
 * Catalog cong khai (danh muc + san pham global). Storefront theo store
 * dung /stores/:storeId/products.
 */
@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('categories')
  categories() {
    return this.catalogService.listCategories();
  }

  @Public()
  @Get('products')
  products(@Query() query: ProductQueryDto) {
    return this.catalogService.listProducts(query);
  }

  @Public()
  @Get('search/autocomplete')
  autocomplete(@Query('q') q: string) {
    return this.catalogService.autocomplete(q);
  }

  @Public()
  @Get('products/:identifier')
  product(@Param('identifier') identifier: string) {
    return this.catalogService.getProduct(identifier);
  }

  @Public()
  @Get('products/:identifier/related')
  related(@Param('identifier') identifier: string) {
    return this.catalogService.relatedProducts(identifier);
  }
}
