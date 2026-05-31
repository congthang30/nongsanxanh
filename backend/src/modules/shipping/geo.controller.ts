import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { Public } from '../../common/decorators/public.decorator';
import { AutocompleteDto, PlaceDetailsDto } from './dto/geo.dto';

/**
 * Proxy geocoding cho frontend, dung OpenStreetMap Nominatim.
 * Ho tro ca POST (legacy) va GET (FE moi).
 */
@ApiTags('geo')
@Public()
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('autocomplete')
  async autocompleteGet(@Query('input') input: string) {
    const predictions = await this.geo.autocomplete(input ?? '');
    return { provider: this.geo.provider, predictions };
  }

  @Get('reverse')
  async reverse(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.geo.reverse(Number(lat), Number(lng));
  }

  @Post('autocomplete')
  async autocomplete(@Body() dto: AutocompleteDto) {
    const predictions = await this.geo.autocomplete(dto.input);
    return { provider: this.geo.provider, predictions };
  }

  @Post('geocode')
  geocode(@Body() dto: PlaceDetailsDto) {
    return this.geo.geocode({ placeId: dto.placeId, text: dto.text });
  }

  // Backward compat
  @Post('place-details')
  placeDetails(@Body() dto: PlaceDetailsDto) {
    return this.geo.geocode({ placeId: dto.placeId, text: dto.text });
  }
}
