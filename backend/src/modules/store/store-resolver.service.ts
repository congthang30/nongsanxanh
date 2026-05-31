import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { GeoService } from '../shipping/geo.service';
import { StoreInventoryService } from '../inventory/inventory.service';

export interface ResolveInput {
  lat?: number | null;
  lng?: number | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  cartItems?: { variantId: string; quantity: number }[];
}

export interface StoreCandidate {
  storeId: string;
  storeName: string;
  storeCode: string;
  province: string;
  district: string | null;
  distanceKm: number | null;
  areaSpecificity: number; // 3=ward, 2=district, 1=province, 0=radius
  hasShipper: boolean;
  inStock: boolean;
  outOfStockVariantIds: string[];
  serviceable: boolean;
  reason: string;
}

export interface ResolveResult {
  serviceable: boolean;
  selectedStore: StoreCandidate | null;
  alternatives: StoreCandidate[];
  reason: string;
  assignmentReason: string | null;
  assignmentDistanceKm: number | null;
}

/** Chuan hoa ten dia gioi de so khop (bo dau, bo tien to TP/Tinh/Quan...). */
function normalizeArea(s?: string | null): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .toLowerCase()
    .replace(/^(tp\.?|thanh\s*pho|tinh|quan|huyen|phuong|xa|thi\s*xa|thi\s*tran)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function areaEquals(a?: string | null, b?: string | null): boolean {
  const na = normalizeArea(a);
  const nb = normalizeArea(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na === 'hcm' && nb.includes('ho chi minh')) return true;
  if (nb === 'hcm' && na.includes('ho chi minh')) return true;
  return na.includes(nb) || nb.includes(na);
}

/**
 * Dich vu chon cua hang phu hop nhat cho mot dia chi giao hang.
 *
 * Mo hinh moi (BHX-style):
 *   - KHONG dung serviceArea de gating. Cua hang phuc vu MOI dia chi du xa.
 *   - Chon cua hang co khoang cach NGAN NHAT toi dia chi giao.
 *   - Yeu cau: store ACTIVE + co primaryShipper ACTIVE + du ton kho cho cart.
 *   - Phi ship tinh theo distance that su (ShippingQuoteService).
 */
@Injectable()
export class StoreResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly inventory: StoreInventoryService,
  ) {}

  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const stores = await this.prisma.store.findMany({
      where: { status: 'ACTIVE' },
      include: {
        primaryShipper: { select: { id: true, status: true } },
      },
    });

    const candidates: StoreCandidate[] = [];

    for (const store of stores) {
      // --- Distance (uu tien geo provider, fallback haversine) ---
      let distanceKm: number | null = null;
      if (
        input.lat != null &&
        input.lng != null &&
        store.lat != null &&
        store.lng != null
      ) {
        try {
          const d = await this.geo.distance(
            { lat: store.lat, lng: store.lng },
            { lat: input.lat, lng: input.lng },
          );
          distanceKm = Number.isFinite(d.distanceKm) ? d.distanceKm : null;
        } catch {
          distanceKm = null;
        }
        if (distanceKm == null) {
          distanceKm = this.haversine(
            store.lat,
            store.lng,
            input.lat,
            input.lng,
          );
        }
      }

      // --- Shipper ---
      const hasShipper =
        !!store.primaryShipperId &&
        store.primaryShipper?.status === 'ACTIVE';

      // --- Inventory ---
      let inStock = true;
      const outOfStockVariantIds: string[] = [];
      if (input.cartItems && input.cartItems.length > 0) {
        const variantIds = input.cartItems.map((i) => i.variantId);
        const availMap = await this.inventory.getAvailabilityMap(
          store.id,
          variantIds,
        );
        for (const item of input.cartItems) {
          const available = availMap.get(item.variantId) ?? 0;
          if (available < item.quantity) {
            inStock = false;
            outOfStockVariantIds.push(item.variantId);
          }
        }
      }

      const serviceable = hasShipper && inStock;
      let reason = 'NEAREST_STORE';
      if (!hasShipper) reason = 'STORE_NO_SHIPPER';
      else if (!inStock) reason = 'STORE_OUT_OF_STOCK';

      candidates.push({
        storeId: store.id,
        storeName: store.name,
        storeCode: store.code,
        province: store.province,
        district: store.district,
        distanceKm,
        areaSpecificity: 0, // legacy field, no longer used for ranking
        hasShipper,
        inStock,
        outOfStockVariantIds,
        serviceable,
        reason,
      });
    }

    // Sap xep: serviceable truoc, distance gan hon (null distance xuong cuoi)
    const sorted = candidates.sort((a, b) => {
      if (a.serviceable !== b.serviceable) return a.serviceable ? -1 : 1;
      const da = a.distanceKm ?? Number.MAX_SAFE_INTEGER;
      const db = b.distanceKm ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });

    const serviceableStores = sorted.filter((c) => c.serviceable);
    const selected = serviceableStores[0] ?? null;

    let reason: string;
    if (selected) {
      reason = 'OK';
    } else if (candidates.length === 0) {
      reason = 'NO_ACTIVE_STORE';
    } else if (candidates.every((c) => !c.inStock)) {
      reason = 'STORE_OUT_OF_STOCK';
    } else if (candidates.every((c) => !c.hasShipper)) {
      reason = 'STORE_NO_SHIPPER';
    } else {
      reason = 'NO_SERVICEABLE_STORE';
    }

    return {
      serviceable: !!selected,
      selectedStore: selected,
      alternatives: sorted.filter((c) => c.storeId !== selected?.storeId),
      reason,
      assignmentReason: selected ? selected.reason : null,
      assignmentDistanceKm: selected ? selected.distanceKm : null,
    };
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3;
  }
}
