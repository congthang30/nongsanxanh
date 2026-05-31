import { apiPost } from './client';

/**
 * Shipper live location.
 *
 * ⚠️ TODO(backend): endpoint `POST /shipper/location` CHUA TON TAI tren backend hien tai
 * (da verify controllers). Wrapper nay san sang nhung se nhan 404 cho den khi backend them.
 *
 * Body de xuat (theo MOBILE_CUSTOMER_SHIPPER_APP_SPEC muc 7.5):
 *   { deliveryId, lat, lng, accuracy?, heading?, speed?, recordedAt }
 *
 * Khi backend san sang: bo cờ DISABLED ben duoi.
 */
const LOCATION_ENDPOINT_AVAILABLE = false;

export interface ShipperLocationPayload {
  deliveryId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  recordedAt: string;
}

export const locationApi = {
  available: LOCATION_ENDPOINT_AVAILABLE,
  async report(payload: ShipperLocationPayload): Promise<{ skipped: boolean }> {
    if (!LOCATION_ENDPOINT_AVAILABLE) {
      // No-op cho den khi backend co endpoint. Khong nem loi de khong vo UX shipper.
      return { skipped: true };
    }
    await apiPost('/shipper/location', payload);
    return { skipped: false };
  },
};
