import { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = (response: Record<string, unknown>) => ({
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        method: 'GET',
        url: '/api/v1/orders/example',
        correlationId: 'req-test',
      }),
    }),
  }) as unknown as ArgumentsHost;

  it('does not expose internal database errors to the client', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const filter = new HttpExceptionFilter();
    const host = createHost({ status, json, headersSent: false, writableEnded: false });

    filter.catch(
      new Error('Invalid prisma invocation: Authentication failed for database credentials'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
        details: undefined,
        correlationId: 'req-test',
      },
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain('prisma');
    expect(JSON.stringify(json.mock.calls)).not.toContain('credentials');
  });

  it('does not write another response after headers were sent', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const filter = new HttpExceptionFilter();

    filter.catch(
      new Error('Cannot set headers after they are sent to the client'),
      createHost({ status, json, headersSent: true, writableEnded: false }),
    );

    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});
