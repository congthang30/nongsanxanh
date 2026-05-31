import { apiGet, apiPost } from './client';
import { DeliveryJob } from '../../types';

/**
 * Shipper jobs. Shipper chi thay delivery da gan cho minh (backend check ownership).
 * KHONG co offers/accept/reject.
 */
export const shipperApi = {
  jobs(scope: 'active' | 'history' = 'active') {
    return apiGet<DeliveryJob[]>('/shipper/jobs', { params: { scope } });
  },
  job(id: string) {
    return apiGet<DeliveryJob>(`/shipper/jobs/${id}`);
  },
  pickedFromStore(id: string) {
    return apiPost<DeliveryJob>(`/shipper/jobs/${id}/picked-from-store`);
  },
  outForDelivery(id: string) {
    return apiPost<DeliveryJob>(`/shipper/jobs/${id}/out-for-delivery`);
  },
  arrived(id: string) {
    return apiPost<DeliveryJob>(`/shipper/jobs/${id}/arrived`);
  },
  /** COD confirm: codCollected = da thu du tien hay chua. */
  delivered(id: string, codCollected?: boolean) {
    return apiPost<DeliveryJob>(`/shipper/jobs/${id}/delivered`, { codCollected });
  },
  failed(id: string, reason: string) {
    return apiPost<DeliveryJob>(`/shipper/jobs/${id}/failed`, { reason });
  },
};
