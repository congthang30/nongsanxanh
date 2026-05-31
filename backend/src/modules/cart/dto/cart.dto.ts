import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AddCartItemDto {
  @ApiPropertyOptional({ description: 'Khong con dung - store duoc resolve theo dia chi khi checkout' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class RevalidateCartDto {
  @ApiPropertyOptional({ description: 'Store moi de revalidate (vd khi doi dia chi)' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressId?: string;
}

export class CheckoutQuoteDto {
  @ApiProperty({ description: 'Dia chi giao da xac thuc (bat buoc de resolve store)' })
  @IsString()
  @IsNotEmpty()
  addressId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ enum: ['COD', 'VNPAY'], default: 'COD' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
