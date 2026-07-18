import { create } from 'zustand';
import { useBranchContextStore } from './branch-context.store';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  setSession: (data: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const stored = localStorage.getItem('authUser');

export function getAccessTokenRoles(): string[] {
  const token = localStorage.getItem('accessToken');
  if (!token) return [];

  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { roles?: unknown };
    return Array.isArray(payload.roles)
      ? payload.roles.filter((role): role is string => typeof role === 'string')
      : [];
  } catch {
    return [];
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: stored ? JSON.parse(stored) : null,
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('authUser', JSON.stringify(user));
    const isAdmin = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
    if (!isAdmin) {
      useBranchContextStore.getState().clearActiveBranch();
      localStorage.removeItem('adminActiveRole');
    }
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    useBranchContextStore.getState().clearActiveBranch();
    localStorage.removeItem('adminActiveRole');
    set({ user: null });
  },
  hasRole: (...roles) => {
    const u = get().user;
    return !!u && roles.some((r) => u.roles.includes(r));
  },
}));
