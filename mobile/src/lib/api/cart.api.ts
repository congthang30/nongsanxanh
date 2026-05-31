import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { Cart, CheckoutQuote } from '../../types';

export const cartApi = {
  get() {
    return apiGet<Cart>('/cart');
  },
  addItem(input: { variantId: string; quantity: number; storeId?: string }) {
    return apiPost<Cart>('/cart/items', input);
  },
  updateItem(id: string, quantity: number) {
    return apiPatch<Cart>(`/cart/items/${id}`, { quantity });
  },
  removeItem(id: string) {
    return apiDelete<Cart>(`/cart/items/${id}`);
  },
  /** Revalidate khi doi dia chi/store. Backend tu thu store gan tiep theo neu thieu hang. */
  revalidate(input: { storeId?: string; addressId?: string }) {
    return apiPost<Cart>('/cart/revalidate', input);
  },
  /** Quote truoc khi dat. Backend resolve store tu addressId (source of truth). */
  checkoutQuote(input: { addressId: string; couponCode?: string; paymentMethod?: string }) {
    return apiPost<CheckoutQuote>('/cart/checkout/quote', input);
  },
};
