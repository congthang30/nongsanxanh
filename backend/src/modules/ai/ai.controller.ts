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
import { ChatDto, VectorSyncDto } from './dto/ai.dto';
import { AiVectorSyncService } from './ai-vector-sync.service';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly vectorSync: AiVectorSyncService,
  ) {}

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
  history(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.aiService.history(id, user?.id, sessionId);
  }

  @ApiBearerAuth()
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('reindex')
  reindex() {
    return this.aiService.reindexDomainObjects();
  }

  @ApiBearerAuth()
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Post('vector-sync')
  syncObject(@Body() dto: VectorSyncDto) {
    return this.vectorSync.enqueue(dto.objectType, dto.objectId, 'manual');
  }
}
