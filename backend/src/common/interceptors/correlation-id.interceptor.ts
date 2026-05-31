import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

/**
 * Gan correlation ID cho moi request de trace xuyen suot.
 * Uu tien header X-Request-ID/X-Correlation-Id tu client, neu khong co thi sinh moi.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const incoming =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string);
    const correlationId = incoming || `req_${randomUUID()}`;

    (req as Request & { correlationId?: string }).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    return next.handle();
  }
}
