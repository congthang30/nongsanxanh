import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../auth/tokenStore';
import { getSessionId } from './session';

/**
 * API client tap trung. KHONG goi axios truc tiep trong component/feature service
 * — luon qua client nay de co interceptor token + xu ly 401 + unwrap envelope.
 *
 * Envelope backend: { success, data, meta?, correlationId }.
 * client tra ve thang `data` (da unwrap) cho cac helper get/post/...
 */

const baseURL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'http://localhost:3000/api/v1';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  correlationId?: string;
}

/** Loi API da chuan hoa de UI hien message tieng Viet tu backend. */
export class ApiError extends Error {
  code: string;
  status: number;
  meta?: unknown;
  constructor(message: string, code: string, status: number, meta?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

type LogoutHandler = () => void;
let onForcedLogout: LogoutHandler | null = null;
/** Auth store dang ky callback de khi refresh that bai thi logout toan app. */
export function setForcedLogoutHandler(fn: LogoutHandler | null) {
  onForcedLogout = fn;
}

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Request interceptor: bearer token + x-session-id ----
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  // Cart guest can session id
  const sessionId = await getSessionId();
  config.headers.set('x-session-id', sessionId);
  return config;
});

// ---- Response interceptor: unwrap envelope + 401 refresh ----
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  try {
    // Goi truc tiep (khong qua `api`) de tranh vong lap interceptor.
    const res = await axios.post<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
      `${baseURL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    );
    const data = res.data?.data;
    if (data?.accessToken && data?.refreshToken) {
      await saveTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown> & { code?: string; message?: string }>) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status ?? 0;

    // 401 -> thu refresh mot lan
    const isRefreshCall = original?.url?.includes('/auth/refresh');
    if (status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true;
      if (!refreshing) refreshing = doRefresh();
      const ok = await refreshing.finally(() => {
        refreshing = null;
      });
      if (ok) {
        const token = await getAccessToken();
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${token}`;
        return api(original);
      }
      // Refresh fail -> logout
      await clearTokens();
      onForcedLogout?.();
    }

    // Chuan hoa loi
    const body = error.response?.data as
      | { message?: string | string[]; code?: string }
      | undefined;
    const rawMsg = body?.message;
    const message = Array.isArray(rawMsg)
      ? rawMsg.join(', ')
      : rawMsg ?? error.message ?? 'Loi ket noi';
    const code = body?.code ?? 'API_ERROR';
    return Promise.reject(new ApiError(message, code, status, error.response?.data));
  },
);

/** Helper: unwrap `data` tu envelope. */
function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as object) && 'success' in (payload as object)) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<ApiEnvelope<T>>(url, config);
  return unwrap<T>(res.data);
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.post<ApiEnvelope<T>>(url, body, config);
  return unwrap<T>(res.data);
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.patch<ApiEnvelope<T>>(url, body, config);
  return unwrap<T>(res.data);
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.delete<ApiEnvelope<T>>(url, config);
  return unwrap<T>(res.data);
}

/** Cho service can ca meta (vd pagination tu store products tra { data, meta }). */
export async function apiGetRaw<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  // Mot so endpoint tra { data, meta } -> interceptor backend tach meta ra ngoai envelope.
  // Truong hop nay `data` la mang, `meta` o ngoai. Ta gop lai thanh { data, meta }.
  const res = await api.get<ApiEnvelope<T>>(url, config);
  const env = res.data;
  if (env && typeof env === 'object' && 'meta' in env) {
    return { data: env.data, meta: env.meta } as unknown as T;
  }
  return unwrap<T>(env);
}

export const API_BASE_URL = baseURL;
