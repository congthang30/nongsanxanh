import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { AiVectorIndexerService } from './ai-vector-indexer.service';
import {
  AI_VECTOR_SYNC_QUEUE,
  AiVectorSyncJob,
} from './ai-vector-sync.types';

@Injectable()
export class AiVectorSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiVectorSyncWorker.name);
  private connection?: Redis;
  private worker?: Worker<AiVectorSyncJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly indexer: AiVectorIndexerService,
  ) {}

  onModuleInit() {
    this.connection = new Redis(
      this.config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      { maxRetriesPerRequest: null, enableReadyCheck: false },
    );
    const concurrency = Math.max(
      1,
      Number(this.config.get<string>('AI_VECTOR_SYNC_CONCURRENCY', '2')) || 2,
    );
    this.worker = new Worker<AiVectorSyncJob>(
      AI_VECTOR_SYNC_QUEUE,
      (job: Job<AiVectorSyncJob>) =>
        this.indexer.syncObject(job.data.objectType, job.data.objectId),
      { connection: this.connection, concurrency },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Vector sync failed for ${job?.data.objectType}:${job?.data.objectId}: ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
