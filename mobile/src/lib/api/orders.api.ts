import { apiGet, apiPost } from './client';
import { CreateOrderInput, Order } from '../../types';

export const ordersApi = {
  /**
   * Tao don. KHONG gui storeId — backend resolve lai tu addressId la source of truth.
   */
  create(input: CreateOrderInput) {
    return apiPost<Order>('/orders', input);
  },
  list() {
    return apiGet<Order[]>('/orders');
  },
  detail(id: string) {
    return apiGet<Order>(`/orders/${id}`);
  },
  cancel(id: string, reason?: string) {
    return apiPost<Order>(`/orders/${id}/cancel`, { reason });
  },
};
