import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  AI_VECTOR_OBJECT_TYPES,
  AiVectorObjectType,
} from '../ai-vector-sync.types';

export class ChatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class VectorSyncDto {
  @ApiProperty({ enum: AI_VECTOR_OBJECT_TYPES })
  @IsIn(AI_VECTOR_OBJECT_TYPES)
  objectType: AiVectorObjectType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  objectId: string;
}
