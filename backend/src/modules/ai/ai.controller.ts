import { Body, Controller, Get, Param, Post, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE } from '../../common/constants/roles.constant';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { ChatDto, IngestDocDto } from './dto/ai.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Chat cong khai: ho tro ca khach chua dang nhap (qua sessionId).
   * Neu co token, controller van lay user de tool tra cuu don hoat dong.
   */
  @Public()
  @Post('chat')
  chat(
    @Body() dto: ChatDto,
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.aiService.chat({
      message: dto.message,
      conversationId: dto.conversationId,
      userId: user?.id,
      sessionId,
    });
  }

  @Public()
  @Get('conversations/:id')
  history(@Param('id') id: string) {
    return this.aiService.history(id);
  }

  @ApiBearerAuth()
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('documents')
  ingest(@Body() dto: IngestDocDto) {
    return this.aiService.ingestDocument(dto.title, dto.sourceType ?? 'MANUAL', dto.content, dto.sourceRef);
  }
}
