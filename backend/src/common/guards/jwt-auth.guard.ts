import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global JWT guard. Bo qua route gan @Public().
 * Verify access token va gan payload vao req.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);

    // Route @Public(): khong bat buoc token, nhung neu co token hop le thi
    // van gan req.user (optional auth) de chatbot/cart nhan dien user dang nhap.
    if (isPublic) {
      if (token) {
        try {
          const payload = await this.jwt.verifyAsync(token, {
            secret: this.config.get<string>('JWT_ACCESS_SECRET'),
          });
          (req as Request & { user?: unknown }).user = {
            id: payload.sub,
            email: payload.email,
            roles: payload.roles ?? [],
            permissions: payload.permissions ?? [],
            sessionId: payload.sessionId,
          };
        } catch {
          // Token loi tren route public -> bo qua, coi nhu khach an danh
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Thieu access token',
      });
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      (req as Request & { user?: unknown }).user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
        sessionId: payload.sessionId,
      };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Access token khong hop le hoac het han',
      });
    }
  }

  private extractToken(req: Request): string | undefined {
    const auth = req.headers.authorization;
    if (!auth) return undefined;
    const [type, token] = auth.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
