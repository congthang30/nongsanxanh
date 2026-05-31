import { Injectable } from '@nestjs/common';
import { GeoService, GeoPoint } from './geo.service';

export interface FeeBreakdownItem {
  label: string;
  amount: number;
}

export interface ShippingQuote {
  method: string;
  distanceKm: number;
  durationMin: number;
  etaFrom: Date;
  etaTo: Date;
  shippingFee: number;
  feeBreakdown: FeeBreakdownItem[];
  provider: string;
}

interface MethodConfig {
  label: string;
  base: number;
  perKm: number;
  min: number;
  coldSurcharge: number;
  prepMin: number; // thoi gian soan hang truoc khi giao
  windowMin: number; // do rong cua so ETA
}

const METHOD_CONFIG: Record<string, MethodConfig> = {
  STANDARD: { label: 'Tieu chuan', base: 15000, perKm: 4000, min: 20000, coldSurcharge: 0, prepMin: 120, windowMin: 240 },
  EXPRESS: { label: 'Nhanh', base: 22000, perKm: 6000, min: 35000, coldSurcharge: 0, prepMin: 30, windowMin: 90 },
  COLD: { label: 'Van chuyen lanh', base: 30000, perKm: 7000, min: 35000, coldSurcharge: 15000, prepMin: 60, windowMin: 180 },
};

// Dieu kien mien phi ship
const FREE_SHIP_MIN_SUBTOTAL = 300000;
const FREE_SHIP_MAX_KM = 10;

@Injectable()
export class ShippingQuoteService {
  constructor(private readonly geo: GeoService) {}

  /**
   * Tinh phi ship + ETA theo khoang cach that tu kho den dia chi giao.
   * subtotal dung de xet dieu kien mien phi ship.
   */
  async quote(params: {
    origin: GeoPoint;
    dropoff: GeoPoint;
    method: string;
    subtotal: number;
  }): Promise<ShippingQuote> {
    const cfg = METHOD_CONFIG[params.method] ?? METHOD_CONFIG.STANDARD;
    const { distanceKm, durationMin, provider } = await this.geo.distance(
      params.origin,
      params.dropoff,
    );

    const breakdown: FeeBreakdownItem[] = [];
    breakdown.push({ label: 'Phi co ban', amount: cfg.base });

    const kmFee = Math.round(distanceKm * cfg.perKm);
    breakdown.push({ label: `Phi theo quang duong (${distanceKm} km)`, amount: kmFee });

    if (cfg.coldSurcharge > 0) {
      breakdown.push({ label: 'Phu phi giu lanh', amount: cfg.coldSurcharge });
    }

    let fee = cfg.base + kmFee + cfg.coldSurcharge;

    // Ap dung phi toi thieu
    if (fee < cfg.min) {
      breakdown.push({ label: 'Dieu chinh phi toi thieu', amount: cfg.min - fee });
      fee = cfg.min;
    }

    // Mien phi ship neu du dieu kien
    const freeEligible =
      params.subtotal >= FREE_SHIP_MIN_SUBTOTAL && distanceKm <= FREE_SHIP_MAX_KM;
    if (freeEligible) {
      breakdown.push({ label: `Mien phi ship (don >= ${FREE_SHIP_MIN_SUBTOTAL / 1000}k & <= ${FREE_SHIP_MAX_KM}km)`, amount: -fee });
      fee = 0;
    }

    const now = Date.now();
    const etaFrom = new Date(now + (cfg.prepMin + durationMin) * 60000);
    const etaTo = new Date(etaFrom.getTime() + cfg.windowMin * 60000);

    return {
      method: params.method,
      distanceKm,
      durationMin,
      etaFrom,
      etaTo,
      shippingFee: fee,
      feeBreakdown: breakdown,
      provider,
    };
  }
}
