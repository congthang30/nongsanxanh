import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  version: string;
}

/**
 * Endpoint liveness check — được dùng bởi Docker healthcheck và CI/CD pipeline.
 * Route được đánh dấu @Public() nên không cần JWT.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness check — trả về 200 nếu service đang chạy' })
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? '0.0.0',
    };
  }
}
