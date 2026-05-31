import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  storeId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Ghi audit log cho cac hanh dong nhay cam:
 * assign store, reassign store, inventory adjustment, cancel order,
 * delivery failed, refund, assign manager/shipper.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    try {
      await client.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          targetType: entry.targetType,
          targetId: entry.targetId,
          storeId: entry.storeId ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      // Audit khong duoc lam vo nghiep vu chinh
      this.logger.warn(`audit log failed: ${(e as Error).message}`);
    }
  }

  list(filter?: { action?: string; targetType?: string; storeId?: string }) {
    return this.prisma.auditLog.findMany({
      where: {
        action: filter?.action,
        targetType: filter?.targetType,
        storeId: filter?.storeId,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { include: { profile: true } } },
    });
  }
}
