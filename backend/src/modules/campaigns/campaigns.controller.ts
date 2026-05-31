import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import { CreateCampaignDto, CreateComboDto } from './dto/campaigns.dto';

@ApiTags('campaigns')
@Controller()
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Public()
  @Get('flash-sales')
  flashSales() {
    return this.campaignsService.activeFlashSales();
  }

  @Public()
  @Get('combos')
  combos() {
    return this.campaignsService.listCombos();
  }

  @ApiBearerAuth()
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('admin/campaigns')
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.createCampaign(dto);
  }

  @ApiBearerAuth()
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('admin/combos')
  createCombo(@Body() dto: CreateComboDto) {
    return this.campaignsService.createCombo(dto);
  }
}
