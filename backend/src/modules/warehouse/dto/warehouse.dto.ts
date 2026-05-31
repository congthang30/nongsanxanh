import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class PickedItemDto {
  @ApiProperty()
  @IsString()
  orderItemId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  quantityPicked: number;
}

export class MarkPackedDto {
  @ApiPropertyOptional({ type: [PickedItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickedItemDto)
  pickedItems?: PickedItemDto[];
}

export class ImportStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdjustStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ example: 50, description: 'So luong ton moi (kiem ke)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ExportStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ example: 5, description: 'So luong xuat kho hoac hu hong' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ description: 'Ly do (bat buoc)' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    enum: ['EXPORT', 'LOSS'],
    description: 'EXPORT=chuyen di, LOSS=hu hong/mat',
  })
  @IsOptional()
  @IsIn(['EXPORT', 'LOSS'])
  kind?: 'EXPORT' | 'LOSS';
}
