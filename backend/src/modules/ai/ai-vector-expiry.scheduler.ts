import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiVectorIndexerService } from './ai-vector-indexer.service';

@Injectable()
export class AiVectorExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiVectorExpiryScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly indexer: AiVectorIndexerService,
  ) {}

  onModuleInit() {
    const interval = Math.max(
      60_000,
      Number(
        this.config.get<string>(
          'AI_VECTOR_EXPIRY_SCAN_INTERVAL_MS',
          '900000',
        ),
      ) || 900_000,
    );
    this.timer = setInterval(() => void this.scan(), interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async scan() {
    if (this.running) return;
    this.running = true;
    try {
      await this.indexer.inactivateExpiredObjects();
    } catch (error) {
      this.logger.warn(`Vector expiry scan failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
