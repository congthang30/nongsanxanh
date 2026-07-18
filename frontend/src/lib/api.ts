import axios from 'axios';
import { useBranchContextStore } from './branch-context.store';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({ baseURL });

let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
  sessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now();
  localStorage.setItem('sessionId', sessionId);
}

export const getSessionId = () => sessionId as string;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  config.headers['X-Session-Id'] = getSessionId();

  const activeBranchId = useBranchContextStore.getState().activeBranchId;
  const requestPath = config.url ?? '';
  const isGlobalAdminRequest =
    requestPath === '/admin/stores' ||
    requestPath.startsWith('/admin/stores/') ||
    requestPath.startsWith('/admin/media') ||
    requestPath.startsWith('/admin/barcodes');
  const usesAdminStoreContext =
    requestPath.startsWith('/pos') ||
    (requestPath.startsWith('/admin/') && !isGlobalAdminRequest);

  if (usesAdminStoreContext) {
    if (activeBranchId) {
      config.headers['X-Active-Branch-Id'] = activeBranchId;
    }

    // Only inject storeId when the caller did not set it explicitly.
    // Explicit empty/undefined means "all stores" and must not be overwritten.
    const params = { ...((config.params ?? {}) as Record<string, unknown>) };
    const hasExplicitStoreId = Object.prototype.hasOwnProperty.call(params, 'storeId');
    if (!hasExplicitStoreId) {
      if (activeBranchId) params.storeId = activeBranchId;
    } else if (params.storeId == null || params.storeId === '') {
      delete params.storeId;
    }
    config.params = params;

    if (
      activeBranchId &&
      config.data &&
      typeof config.data === 'object' &&
      !(config.data instanceof FormData)
    ) {
      const body = config.data as Record<string, unknown>;
      const bodyHasStoreId = Object.prototype.hasOwnProperty.call(body, 'storeId');
      // Never overwrite a concrete storeId chosen in forms/modals.
      if (!bodyHasStoreId || body.storeId == null || body.storeId === '') {
        config.data = { ...body, storeId: activeBranchId };
      }
    }
  }
  return config;
});

let refreshing = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      localStorage.getItem('refreshToken') &&
      !original.url?.includes('/auth/')
    ) {
      original._retry = true;
      if (!refreshing) {
        refreshing = true;
        try {
          const { data } = await axios.post(baseURL + '/auth/refresh', {
            refreshToken: localStorage.getItem('refreshToken'),
          });
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          refreshing = false;
        } catch (refreshError) {
          refreshing = false;
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
      original.headers.Authorization = 'Bearer ' + localStorage.getItem('accessToken');
      return api(original);
    }
    return Promise.reject(error);
  },
);

export function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  return promise.then((response) => response.data.data);
}

export function getErrorMessage(error: unknown): string {
  const value = error as { response?: { data?: { error?: { message?: string } } } };
  return value?.response?.data?.error?.message ?? 'Đã có lỗi xảy ra';
}