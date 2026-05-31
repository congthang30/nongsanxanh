import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Chuan hoa moi loi thanh:
 * { success:false, error:{ code, message, details, correlationId } }
 * Khong tra stack trace cho client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId =
      (req as Request & { correlationId?: string }).correlationId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Da co loi xay ra';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
        code = this.statusToCode(status);
      } else if (resp && typeof resp === 'object') {
        const r = resp as Record<string, unknown>;
        message = (r.message as string) ?? message;
        code = (r.code as string) ?? this.statusToCode(status);
        details = r.details ?? (Array.isArray(r.message) ? r.message : undefined);
        if (Array.isArray(r.message)) {
          message = 'Du lieu khong hop le';
          details = r.message;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${req.method} ${req.url} -> ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] ${req.method} ${req.url} -> ${status}: ${message}`,
      );
    }

    res.status(status).json({
      success: false,
      error: { code, message, details, correlationId },
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
    };
    return map[status] ?? 'ERROR';
  }
}
