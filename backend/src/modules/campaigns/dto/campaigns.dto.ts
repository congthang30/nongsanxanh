import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
  Min,
  ValidateNested,
} from 'class-validator';

class CampaignItemInput {
  @ApiProperty()
  @IsString()
  variantId: string;

  @ApiPropertyOptional({ description: 'Lô tồn kho cụ thể; bỏ trống để áp dụng toàn phiên bản' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salePrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
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
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiProperty({ type: [CampaignItemInput] })
  @IsArray()
  @ArrayMinSize(1)
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
