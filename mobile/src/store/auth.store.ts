import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthTokens, AuthUser, RoleCode } from '../types';
import { authApi } from '../lib/api/auth.api';
import {
  clearTokens,
  getAccessToken,
  saveTokens,
} from '../lib/auth/tokenStore';
import { setForcedLogoutHandler } from '../lib/api/client';

export type AppMode = 'customer' | 'shipper';
const LAST_MODE_KEY = 'nsx.lastMode';

interface AuthState {
  user: AuthUser | null;
  /** Mode hien tai (neu user co ca 2 role). */
  mode: AppMode;
  /** Dang load session khi mo app. */
  initializing: boolean;
  loading: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setMode: (mode: AppMode) => void;
  clearError: () => void;
}

function isShipper(user: AuthUser | null): boolean {
  return !!user?.roles?.includes('SHIPPER' as RoleCode);
}
function isCustomer(user: AuthUser | null): boolean {
  // Mac dinh moi user dang ky deu co CUSTOMER.
  return !!user?.roles?.includes('CUSTOMER' as RoleCode);
}

/** Chon mode khoi tao dua tren role + last mode. */
function resolveInitialMode(user: AuthUser | null, lastMode: AppMode | null): AppMode {
  const shipper = isShipper(user);
  const customer = isCustomer(user);
  if (shipper && customer) {
    // Co ca 2: dung last mode neu hop le, mac dinh shipper (uu tien cong viec).
    if (lastMode === 'customer' || lastMode === 'shipper') return lastMode;
    return 'shipper';
  }
  if (shipper) return 'shipper';
  return 'customer';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  mode: 'customer',
  initializing: true,
  loading: false,
  error: null,

  async bootstrap() {
    // Dang ky callback de interceptor 401 (refresh fail) co the logout toan app.
    setForcedLogoutHandler(() => {
      set({ user: null });
    });
    try {
      const token = await getAccessToken();
      if (!token) {
        set({ initializing: false, user: null });
        return;
      }
      const me = await authApi.me();
      const lastModeRaw = (await AsyncStorage.getItem(LAST_MODE_KEY)) as AppMode | null;
      const user: AuthUser = {
        id: me.id,
        email: me.email,
        fullName: me.fullName,
        roles: me.roles ?? [],
        permissions: me.permissions ?? [],
      };
      set({
        user,
        mode: resolveInitialMode(user, lastModeRaw),
        initializing: false,
      });
    } catch {
      // Token loi/het han va refresh khong duoc -> coi nhu chua dang nhap.
      await clearTokens();
      set({ user: null, initializing: false });
    }
  },

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const tokens: AuthTokens = await authApi.login(email, password);
      await saveTokens({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      const lastModeRaw = (await AsyncStorage.getItem(LAST_MODE_KEY)) as AppMode | null;
      set({
        user: tokens.user,
        mode: resolveInitialMode(tokens.user, lastModeRaw),
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  async register(input) {
    set({ loading: true, error: null });
    try {
      const tokens: AuthTokens = await authApi.register(input);
      await saveTokens({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      set({
        user: tokens.user,
        mode: resolveInitialMode(tokens.user, null),
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      // ignore loi mang khi logout
    }
    await clearTokens();
    set({ user: null, error: null });
  },

  setMode(mode) {
    void AsyncStorage.setItem(LAST_MODE_KEY, mode);
    set({ mode });
  },

  clearError() {
    set({ error: null });
  },
}));

export const authSelectors = {
  isShipper: (s: AuthState) => isShipper(s.user),
  isCustomer: (s: AuthState) => isCustomer(s.user),
  hasBothRoles: (s: AuthState) => isShipper(s.user) && isCustomer(s.user),
};
