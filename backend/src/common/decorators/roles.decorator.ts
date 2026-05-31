import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
/** Yeu cau user co it nhat mot trong cac role duoc liet ke. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
