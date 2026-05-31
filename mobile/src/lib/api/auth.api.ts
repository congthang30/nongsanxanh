import { apiGet, apiPost } from '../api/client';
import { AuthTokens, AuthUser } from '../../types';

export const authApi = {
  login(email: string, password: string) {
    return apiPost<AuthTokens>('/auth/login', { email, password });
  },
  register(input: { email: string; password: string; fullName: string; phone?: string }) {
    return apiPost<AuthTokens>('/auth/register', input);
  },
  refresh(refreshToken: string) {
    return apiPost<AuthTokens>('/auth/refresh', { refreshToken });
  },
  logout() {
    return apiPost<{ message: string }>('/auth/logout');
  },
  /** Tra ve payload token hien tai (id,email,roles,permissions,sessionId). */
  me() {
    return apiGet<AuthUser & { sessionId?: string }>('/auth/me');
  },
};
