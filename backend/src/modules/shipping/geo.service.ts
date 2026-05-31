import { Injectable, Logger } from '@nestjs/common';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends GeoPoint {
  placeId: string;
  formattedAddress: string;
  provider: string;
  confidence: number;
}

export interface AutocompletePrediction {
  placeId: string;
  description: string;
}

export interface ReverseGeocodeResult extends GeoPoint {
  province: string;
  district: string | null;
  ward: string | null;
  formattedAddress: string;
  provider: string;
}

export interface DistanceResult {
  distanceKm: number;
  durationMin: number;
  provider: string;
}

/**
 * Dich vu dia ly dung OpenStreetMap Nominatim (mien phi, khong can API key).
 * - autocomplete / geocode: tra toa do that tu Nominatim.
 * - distance: Haversine x he so duong bo (uoc luong, du cho MVP).
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly ROAD_FACTOR = 1.3; // he so quy doi duong chim bay -> duong bo
  private readonly AVG_SPEED_KMH = 28; // toc do trung binh noi thanh
  private readonly NOMINATIM = 'https://nominatim.openstreetmap.org';
  private readonly UA = 'NongSanXanh/1.0 (mvp demo)';

  get provider(): 'osm' {
    return 'osm';
  }

  /** Goi y dia chi theo input nguoi dung (toi thieu 2 ky tu). */
  async autocomplete(input: string): Promise<AutocompletePrediction[]> {
    const q = (input ?? '').trim();
    if (q.length < 2) return [];
    try {
      return await this.nominatimAutocomplete(q);
    } catch (e) {
      this.logger.warn(`autocomplete that bai: ${(e as Error).message}`);
      return [];
    }
  }

  /** Phan giai placeId (dang "nominatim:<text>") hoac text thanh toa do that. */
  async geocode(query: {
    placeId?: string;
    text?: string;
  }): Promise<GeocodeResult | null> {
    let text = query.text;
    if (!text && query.placeId?.startsWith('nominatim:')) {
      text = decodeURIComponent(query.placeId.slice('nominatim:'.length));
    }
    if (!text) return null;
    try {
      return await this.nominatimGeocode(text);
    } catch (e) {
      this.logger.warn(`geocode that bai: ${(e as Error).message}`);
      return null;
    }
  }

  /** Reverse geocode: tu lat/lng -> ten tinh/quan/phuong (de match service area). */
  async reverse(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    try {
      return await this.nominatimReverse(lat, lng);
    } catch (e) {
      this.logger.warn(`reverse geocode that bai: ${(e as Error).message}`);
      return null;
    }
  }

  /** Khoang cach + thoi gian giua 2 diem (Haversine x he so duong bo). */
  async distance(origin: GeoPoint, dest: GeoPoint): Promise<DistanceResult> {
    return this.haversine(origin, dest);
  }

  // ---------------- Haversine ----------------

  private haversine(origin: GeoPoint, dest: GeoPoint): DistanceResult {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(dest.lat - origin.lat);
    const dLng = toRad(dest.lng - origin.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(origin.lat)) *
        Math.cos(toRad(dest.lat)) *
        Math.sin(dLng / 2) ** 2;
    const straightKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Math.round(straightKm * this.ROAD_FACTOR * 10) / 10;
    const durationMin = Math.max(
      15,
      Math.round((distanceKm / this.AVG_SPEED_KMH) * 60),
    );
    return { distanceKm, durationMin, provider: 'haversine' };
  }

  // ---------------- OpenStreetMap Nominatim ----------------

  private async nominatimAutocomplete(
    input: string,
  ): Promise<AutocompletePrediction[]> {
    const url = `${this.NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=vn&q=${encodeURIComponent(input)}`;
    const res = await fetch(url, { headers: { 'User-Agent': this.UA } });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const rows = (await res.json()) as { display_name: string }[];
    return rows.map((r) => ({
      placeId: `nominatim:${encodeURIComponent(r.display_name)}`,
      description: r.display_name,
    }));
  }

  private async nominatimGeocode(text: string): Promise<GeocodeResult | null> {
    const url = `${this.NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=vn&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { headers: { 'User-Agent': this.UA } });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const rows = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
      importance?: number;
    }[];
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      lat: Number(r.lat),
      lng: Number(r.lon),
      placeId: `nominatim:${encodeURIComponent(r.display_name)}`,
      formattedAddress: r.display_name,
      provider: 'osm',
      confidence: r.importance ?? 0.5,
    };
  }

  private async nominatimReverse(
    lat: number,
    lng: number,
  ): Promise<ReverseGeocodeResult | null> {
    const url = `${this.NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { 'User-Agent': this.UA } });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const province =
      a.city ?? a.state ?? a.province ?? a.town ?? a.county ?? '';
    const district =
      a.city_district ?? a.county ?? a.district ?? a.suburb ?? null;
    const ward = a.ward ?? a.suburb ?? a.quarter ?? a.village ?? null;
    if (!province) return null;
    return {
      lat,
      lng,
      province,
      district,
      ward,
      formattedAddress: data.display_name ?? '',
      provider: 'osm',
    };
  }
}
