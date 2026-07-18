import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import {
  AI_VECTOR_SYNC_QUEUE,
  AiVectorObjectType,
  AiVectorSyncJob,
  AiVectorSyncReason,
} from './ai-vector-sync.types';

@Injectable()
export class AiVectorSyncService implements OnModuleDestroy {
  private readonly connection: Redis;
  private readonly queue: Queue<AiVectorSyncJob>;
  private readonly delay: number;
  private readonly attempts: number;
  private readonly removeOnComplete: number;
  private readonly removeOnFail: number;

  constructor(config: ConfigService) {
    this.delay = this.positiveInt(
      config.get<string>('AI_VECTOR_SYNC_DEBOUNCE_MS', '10000'),
      10000,
      true,
    );
    this.attempts = this.positiveInt(
      config.get<string>('AI_VECTOR_SYNC_ATTEMPTS', '3'),
      3,
    );
    this.removeOnComplete = this.positiveInt(
      config.get<string>('AI_VECTOR_SYNC_REMOVE_ON_COMPLETE', '1000'),
      1000,
    );
    this.removeOnFail = this.positiveInt(
      config.get<string>('AI_VECTOR_SYNC_REMOVE_ON_FAIL', '5000'),
      5000,
    );
    this.connection = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      { maxRetriesPerRequest: null, enableReadyCheck: false },
    );
    this.queue = new Queue<AiVectorSyncJob>(AI_VECTOR_SYNC_QUEUE, {
      connection: this.connection,
    });
  }

  async enqueue(
    objectType: AiVectorObjectType,
    objectId: string,
    reason: AiVectorSyncReason,
  ) {
    // BullMQ reserves ':' in custom IDs, so use a stable hyphenated equivalent.
    const jobId = `ai-vector-sync-${objectType}-${objectId}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== 'active') {
        await existing.remove().catch(() => undefined);
      } else {
        return { jobId, state };
      }
    }

    const job = await this.queue.add(
      'sync-object',
      { objectType, objectId, reason, requestedAt: new Date().toISOString() },
      {
        jobId,
        delay: this.delayFor(reason),
        attempts: this.attempts,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: this.removeOnComplete },
        removeOnFail: { count: this.removeOnFail },
      },
    );
    return { jobId: job.id, state: 'queued' as const };
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }

  private positiveInt(
    value: string | undefined,
    fallback: number,
    allowZero = false,
  ) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && (allowZero ? parsed >= 0 : parsed > 0)
      ? parsed
      : fallback;
  }

  private delayFor(reason: AiVectorSyncReason) {
    return reason === 'created' ? 0 : this.delay;
  }
}
