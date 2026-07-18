import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { StoreScopeService } from './store-scope.service';

@ApiTags('store-context')
@ApiBearerAuth()
@Controller('store-context')
export class StoreContextController {
  constructor(private readonly scope: StoreScopeService) {}

  @Get('branches')
  branches(@CurrentUser() user: AuthUser) {
    return this.scope.listAccessibleStores(user);
  }
}