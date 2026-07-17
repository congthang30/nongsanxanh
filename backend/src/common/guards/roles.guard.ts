import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { SYSTEM_ADMIN_ROLES } from '../constants/roles.constant';

/** Kiem tra user co it nhat mot role yeu cau. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const roles = user?.roles ?? [];

    const ok =
      roles.some((r) => SYSTEM_ADMIN_ROLES.includes(r)) ||
      required.some((r) => roles.includes(r));
    if (!ok) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Ban khong co quyen truy cap tai nguyen nay',
      });
    }
    return true;
  }
}
