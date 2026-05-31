import { apiGet, apiPatch, apiPost } from './client';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list() {
    return apiGet<AppNotification[]>('/notifications');
  },
  unreadCount() {
    return apiGet<{ count: number }>('/notifications/unread-count');
  },
  markRead(id: string) {
    return apiPatch<{ message: string }>(`/notifications/${id}/read`);
  },
  markAllRead() {
    return apiPost<{ message: string }>('/notifications/read-all');
  },
};
