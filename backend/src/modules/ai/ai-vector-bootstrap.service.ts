import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiVectorIndexerService } from './ai-vector-indexer.service';

/**
 * Khi DB da co product seed nhung ai_vector_index trong (seed chay truoc AI / AI fail),
 * tu dong reindex 1 lan luc backend boot — de related products / chatbot co embedding.
 *
 * Tat: AI_AUTO_REINDEX_ON_EMPTY=false
 */
@Injectable()
export class AiVectorBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AiVectorBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly indexer: AiVectorIndexerService,
  ) {}

  async onModuleInit() {
    const enabled =
      (this.config.get<string>('AI_AUTO_REINDEX_ON_EMPTY') ?? 'true')
        .toLowerCase() !== 'false';
    if (!enabled) return;

    // Khong block boot neu reindex lau — chay background.
    void this.maybeReindexEmpty().catch((err) => {
      this.logger.warn(
        `Auto reindex on empty failed: ${(err as Error).message}`,
      );
    });
  }

  private async maybeReindexEmpty() {
    const productCount = await this.prisma.product.count({
      where: {
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        variants: { some: { status: 'ACTIVE' } },
      },
    });
    if (productCount === 0) return;

    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "ai_vector_index"
      WHERE "status" = 'ACTIVE' AND "object_type" = 'PRODUCT'
    `;
    const activeProductVectors = Number(rows[0]?.count ?? 0);
    if (activeProductVectors > 0) {
      this.logger.log(
        `pgvector already has ${activeProductVectors} ACTIVE product vectors — skip auto reindex`,
      );
      return;
    }

    this.logger.log(
      `No ACTIVE product vectors but ${productCount} products present — auto reindex into pgvector...`,
    );
    const result = await this.indexer.reindexDomainObjects();
    this.logger.log(
      `Auto reindex done: indexed=${result.indexed} products=${result.products} coupons=${result.coupons} knowledge=${result.knowledgeSources}`,
    );
  }
}
