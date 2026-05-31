import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AutocompleteDto {
  @ApiProperty({ example: 'so 1 dai co viet' })
  @IsString()
  input: string;
}

export class PlaceDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;
}
