import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({ baseURL });

let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
  sessionId = `sess_${Math.random().toString(36).slice(2)}${Date.now()}`;
  localStorage.setItem('sessionId', sessionId);
}
export const getSessionId = () => sessionId as string;

// Gan access token + session id
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Session-Id'] = getSessionId();
  return config;
});

let refreshing = false;

// Refresh token mot lan khi 401
api.interceptors.response.use(
  (res) => res,
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
          const { data } = await axios.post(`${baseURL}/auth/refresh`, {
            refreshToken: localStorage.getItem('refreshToken'),
          });
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          refreshing = false;
        } catch (e) {
          refreshing = false;
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(e);
        }
      }
      original.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
      return api(original);
    }
    return Promise.reject(error);
  },
);

// Tien ich: tra ve data.data (unwrap chuan response backend)
export function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  return promise.then((r) => r.data.data);
}

export function getErrorMessage(error: unknown): string {
  const e = error as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? 'Da co loi xay ra';
}
