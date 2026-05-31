import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CampaignItemInput {
  @ApiProperty()
  @IsString()
  variantId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salePrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  quantityLimit?: number;
}

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty()
  @IsString()
  startsAt: string;

  @ApiProperty()
  @IsString()
  endsAt: string;

  @ApiProperty({ type: [CampaignItemInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignItemInput)
  items: CampaignItemInput[];
}

class ComboItemInput {
  @ApiProperty()
  @IsString()
  variantId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreateComboDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ type: [ComboItemInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboItemInput)
  items: ComboItemInput[];
}
