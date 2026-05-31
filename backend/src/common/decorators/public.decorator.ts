import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Danh dau route khong yeu cau xac thuc JWT. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
