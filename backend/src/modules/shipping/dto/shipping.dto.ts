import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignShipmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  shipperId: string;

  @ApiPropertyOptional({ default: 'STANDARD' })
  @IsOptional()
  @IsString()
  method?: string;
}

export class ShipmentEventDto {
  @ApiProperty({
    enum: [
      'PICKED_UP',
      'IN_TRANSIT',
      'DELIVERY_ATTEMPTED',
      'DELIVERED',
      'FAILED',
    ],
  })
  @IsIn([
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERY_ATTEMPTED',
    'DELIVERED',
    'FAILED',
  ])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;
}
