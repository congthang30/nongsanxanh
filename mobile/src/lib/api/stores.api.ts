import { apiPost } from './client';
import { ResolveStoreInput, ResolveStoreResult } from '../../types';

/**
 * Store resolve. Backend la source of truth — app KHONG tu chon store.
 * Goi voi addressId (uu tien), hoac lat/lng, hoac province/district/ward.
 * Kem cartItems de resolver kiem tra ton kho khi can fulfillment day du.
 */
export const storesApi = {
  resolve(input: ResolveStoreInput) {
    return apiPost<ResolveStoreResult>('/stores/resolve', input);
  },
};
