import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BarcodeType,
  BarcodeStatus,
  POSPaymentMethod,
} from '@prisma/client';

// ---------------- Shift ----------------

export class OpenShiftDto {
  @ApiPropertyOptional({ example: 500000, description: 'Tien mat dau ca' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  openingCash?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CloseShiftDto {
  @ApiProperty({ example: 1500000, description: 'Tien mat dem duoc cuoi ca' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedCash: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

// ---------------- Sale ----------------

export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'So dien thoai khach (hoi vien)' })
  @IsOptional()
  @IsString()
  customerPhone?: string;
}

export class ScanItemDto {
  @ApiProperty({ description: 'Ma vach quet duoc' })
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @ApiPropertyOptional({
    description: 'Khoi luong/so luong cho san pham can ky (WEIGHT)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity?: number;
}

export class AddItemByVariantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity?: number;
}

export class UpdateItemDto {
  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

class PayPaymentDto {
  @ApiProperty({ enum: POSPaymentMethod })
  @IsEnum(POSPaymentMethod)
  method: POSPaymentMethod;

  @ApiProperty({ example: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Tien khach dua (CASH)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tendered?: number;

  @ApiPropertyOptional({ description: 'Ma tham chieu (chuyen khoan/the)' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class PaySaleDto {
  @ApiProperty({ type: [PayPaymentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayPaymentDto)
  payments: PayPaymentDto[];

  @ApiPropertyOptional({ description: 'Cho phep ban am ton (can quyen)' })
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;
}

export class VoidSaleDto {
  @ApiProperty({ description: 'Ly do huy/void' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

// ---------------- Barcode admin ----------------

export class CreateBarcodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @ApiPropertyOptional({ enum: BarcodeType })
  @IsOptional()
  @IsEnum(BarcodeType)
  type?: BarcodeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateBarcodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ enum: BarcodeType })
  @IsOptional()
  @IsEnum(BarcodeType)
  type?: BarcodeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: BarcodeStatus })
  @IsOptional()
  @IsEnum(BarcodeStatus)
  status?: BarcodeStatus;
}

// ---------------- Return ----------------

class ReturnItemInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  saleItemId: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({ description: 'Hang con ban duoc thi cong ton lai' })
  @IsOptional()
  @IsBoolean()
  restockable?: boolean;
}

export class CreateReturnDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  saleId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ type: [ReturnItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items: ReturnItemInputDto[];
}
