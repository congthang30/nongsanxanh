import { create } from 'zustand';

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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: stored ? JSON.parse(stored) : null,
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('authUser', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    set({ user: null });
  },
  hasRole: (...roles) => {
    const u = get().user;
    return !!u && roles.some((r) => u.roles.includes(r));
  },
}));
