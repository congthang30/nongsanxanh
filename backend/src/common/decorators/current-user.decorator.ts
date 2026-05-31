import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export interface AuthUser {
  id: string;
  email?: string | null;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

/** Lay user da xac thuc tu request (gan boi JwtStrategy). */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
