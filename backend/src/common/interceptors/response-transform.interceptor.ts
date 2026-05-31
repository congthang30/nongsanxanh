import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Chuan hoa moi response thanh cau truc { success, data, meta?, correlationId }.
 * Neu controller tra ve object dang { data, meta } thi tach meta ra ngoai.
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const correlationId =
      (req as Request & { correlationId?: string }).correlationId ??
      (res.getHeader('X-Correlation-Id') as string | undefined);

    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in payload
        ) {
          const { data, meta } = payload as {
            data: T;
            meta: Record<string, unknown>;
          };
          return { success: true, data, meta, correlationId };
        }
        return { success: true, data: payload as T, correlationId };
      }),
    );
  }
}
