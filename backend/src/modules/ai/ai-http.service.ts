import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmbeddingResponse {
  embeddings: number[][];
  dimensions: number;
  model: string;
}

interface GenerateResponse {
  answer?: string | null;
}

@Injectable()
export class AiHttpService {
  private readonly logger = new Logger(AiHttpService.name);
  private readonly baseUrl: string;
  private readonly dimensions: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('AI_SERVICE_URL', 'http://localhost:8000')
      .replace(/\/$/, '');
    this.dimensions = Number(
      config.get<string>('AI_EMBEDDING_DIMENSIONS', '1024'),
    );
  }

  async embed(
    texts: string[],
    task: 'retrieval.query' | 'retrieval.passage',
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, task }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as EmbeddingResponse;
      if (
        data.dimensions !== this.dimensions ||
        data.embeddings.some((embedding) => embedding.length !== this.dimensions)
      ) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.dimensions}, got ${data.dimensions}`,
        );
      }
      return data.embeddings;
    } catch (error) {
      this.logger.warn(`Embedding service unavailable: ${(error as Error).message}`);
      return [];
    }
  }

  async generate(systemPrompt: string, prompt: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, prompt }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as GenerateResponse;
      return data.answer?.trim() || null;
    } catch (error) {
      this.logger.warn(`Generation service unavailable: ${(error as Error).message}`);
      return null;
    }
  }
}
