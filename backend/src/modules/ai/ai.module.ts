import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiHttpService } from './ai-http.service';
import { ChatMemoryStore } from './chat-memory.store';
import { AiVectorIndexerService } from './ai-vector-indexer.service';
import { AiVectorSyncService } from './ai-vector-sync.service';
import { AiVectorSyncWorker } from './ai-vector-sync.worker';
import { AiVectorSyncListener } from './ai-vector-sync.listener';
import { AiVectorExpiryScheduler } from './ai-vector-expiry.scheduler';

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiHttpService,
    ChatMemoryStore,
    AiVectorIndexerService,
    AiVectorSyncService,
    AiVectorSyncWorker,
    AiVectorSyncListener,
    AiVectorExpiryScheduler,
  ],
  exports: [AiService, AiVectorIndexerService, AiVectorSyncService],
})
export class AiModule {}
