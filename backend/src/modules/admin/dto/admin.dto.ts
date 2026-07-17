import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustStockDto, ExportStockDto, ImportStockDto } from '../../warehouse/dto/warehouse.dto';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateStoreDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

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
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  province: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serviceRadiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closeTime?: string;
}

export class UpdateStoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serviceRadiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closeTime?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'PAUSED', 'CLOSED', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'CLOSED', 'SUSPENDED'])
  status?: string;
}

export class CreateServiceAreaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  province: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priority?: number;
}

export class AssignManagerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class AssignShipperDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class AddStaffDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: ['STORE_STAFF', 'WAREHOUSE_STAFF'] })
  @IsIn(['STORE_STAFF', 'WAREHOUSE_STAFF'])
  role: 'STORE_STAFF' | 'WAREHOUSE_STAFF';
}

export class UpdateStoreStaffDto {
  @ApiPropertyOptional({ enum: ['STORE_STAFF', 'WAREHOUSE_STAFF'] })
  @IsOptional()
  @IsIn(['STORE_STAFF', 'WAREHOUSE_STAFF'])
  role?: 'STORE_STAFF' | 'WAREHOUSE_STAFF';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export class CreateStaffAccountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ enum: ['STORE_MANAGER', 'STORE_STAFF', 'WAREHOUSE_STAFF', 'SHIPPER'] })
  @IsIn(['STORE_MANAGER', 'STORE_STAFF', 'WAREHOUSE_STAFF', 'SHIPPER'])
  role: 'STORE_MANAGER' | 'STORE_STAFF' | 'WAREHOUSE_STAFF' | 'SHIPPER';
}

export class UpdateStaffAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: ['STORE_MANAGER', 'STORE_STAFF', 'WAREHOUSE_STAFF', 'SHIPPER'] })
  @IsOptional()
  @IsIn(['STORE_MANAGER', 'STORE_STAFF', 'WAREHOUSE_STAFF', 'SHIPPER'])
  role?: 'STORE_MANAGER' | 'STORE_STAFF' | 'WAREHOUSE_STAFF' | 'SHIPPER';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export class AdminImportStockDto extends ImportStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId: string;
}

export class AdminAdjustStockDto extends AdjustStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId: string;
}

export class AdminExportStockDto extends ExportStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId: string;
}

export class SetUserRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  roles: string[];
}
