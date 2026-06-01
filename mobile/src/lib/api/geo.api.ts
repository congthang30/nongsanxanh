import { apiGet, apiPost } from './client';

/**
 * Geocoding proxy (OpenStreetMap Nominatim) — KHOP voi web customer.
 * Backend endpoints: GET /geo/autocomplete, POST /geo/geocode, GET /geo/reverse.
 * Dung de tim dia chi giao hang (autocomplete) roi lay toa do that.
 */
export interface GeoPrediction {
  placeId: string;
  description: string;
}

export interface GeoGeocode {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface GeoReverse {
  province: string;
  district: string | null;
  ward: string | null;
  formattedAddress: string;
}

export const geoApi = {
  async autocomplete(input: string): Promise<GeoPrediction[]> {
    const res = await apiGet<{ provider: string; predictions: GeoPrediction[] }>(
      '/geo/autocomplete',
      { params: { input } },
    );
    return res.predictions ?? [];
  },

  geocode(placeId: string, text: string): Promise<GeoGeocode | null> {
    return apiPost<GeoGeocode | null>('/geo/geocode', { placeId, text });
  },

  reverse(lat: number, lng: number): Promise<GeoReverse | null> {
    return apiGet<GeoReverse | null>('/geo/reverse', { params: { lat, lng } });
  },
};
