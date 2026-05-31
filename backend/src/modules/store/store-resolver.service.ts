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
 * Thuat toan (theo spec muc 6.3):
 *   1. Lay store ACTIVE.
 *   2. Loc store co service area match dia chi (ward > district > province > radius).
 *   3. Loc store co primary shipper.
 *   4. Loc store du ton cho tat ca cart items.
 *   5. Tinh distance, sap xep theo specificity desc roi distance asc.
 *   6. Chon store dau tien.
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
        serviceAreas: { where: { status: 'ACTIVE' } },
        primaryShipper: { select: { id: true, status: true } },
      },
    });

    const candidates: StoreCandidate[] = [];

    for (const store of stores) {
      // --- Service area match ---
      const { matched, specificity } = this.matchServiceArea(store, input);
      if (!matched) continue;

      // --- Distance ---
      let distanceKm: number | null = null;
      if (
        input.lat != null &&
        input.lng != null &&
        store.lat != null &&
        store.lng != null
      ) {
        const d = await this.geo.distance(
          { lat: store.lat, lng: store.lng },
          { lat: input.lat, lng: input.lng },
        );
        distanceKm = d.distanceKm;
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
      let reason = 'NEAREST_SERVICEABLE_STORE';
      if (!hasShipper) reason = 'STORE_NO_SHIPPER';
      else if (!inStock) reason = 'STORE_OUT_OF_STOCK';

      candidates.push({
        storeId: store.id,
        storeName: store.name,
        storeCode: store.code,
        province: store.province,
        district: store.district,
        distanceKm,
        areaSpecificity: specificity,
        hasShipper,
        inStock,
        outOfStockVariantIds,
        serviceable,
        reason,
      });
    }

    // Sap xep: serviceable truoc, specificity cao hon, distance gan hon
    const sorted = candidates.sort((a, b) => {
      if (a.serviceable !== b.serviceable) return a.serviceable ? -1 : 1;
      if (a.areaSpecificity !== b.areaSpecificity)
        return b.areaSpecificity - a.areaSpecificity;
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
      reason = 'NO_STORE_FOR_AREA';
    } else if (candidates.some((c) => !c.inStock)) {
      reason = 'STORE_OUT_OF_STOCK';
    } else if (candidates.some((c) => !c.hasShipper)) {
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

  private matchServiceArea(
    store: { serviceArea?: never; serviceAreas: { province: string; district: string | null; ward: string | null; radiusKm: number | null }[]; lat: number | null; lng: number | null },
    input: ResolveInput,
  ): { matched: boolean; specificity: number } {
    let best = -1;
    for (const area of store.serviceAreas) {
      // Ward match (specificity 3)
      if (
        area.ward &&
        input.ward &&
        areaEquals(area.province, input.province) &&
        areaEquals(area.district, input.district) &&
        areaEquals(area.ward, input.ward)
      ) {
        best = Math.max(best, 3);
        continue;
      }
      // District match (specificity 2)
      if (
        area.district &&
        input.district &&
        areaEquals(area.province, input.province) &&
        areaEquals(area.district, input.district)
      ) {
        best = Math.max(best, 2);
        continue;
      }
      // Province match (specificity 1) - only if area has no district constraint
      if (
        !area.district &&
        input.province &&
        areaEquals(area.province, input.province)
      ) {
        best = Math.max(best, 1);
        continue;
      }
      // Radius match (specificity 0)
      if (
        area.radiusKm != null &&
        store.lat != null &&
        store.lng != null &&
        input.lat != null &&
        input.lng != null
      ) {
        const dist = this.haversine(
          store.lat,
          store.lng,
          input.lat,
          input.lng,
        );
        if (dist <= area.radiusKm) best = Math.max(best, 0);
      }
    }
    return { matched: best >= 0, specificity: best };
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
