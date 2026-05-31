import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  addressId: string;

  @ApiProperty({ enum: ['COD', 'VNPAY'] })
  @IsIn(['COD', 'VNPAY'])
  paymentMethod: 'COD' | 'VNPAY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class ReturnItemInput {
  @ApiProperty()
  @IsString()
  orderItemId: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;
}

export class ReturnRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ type: [ReturnItemInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInput)
  items: ReturnItemInput[];
}

export class ProcessReturnDto {
  @ApiProperty()
  @IsBoolean()
  approve: boolean;
}

export class ReassignStoreDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
