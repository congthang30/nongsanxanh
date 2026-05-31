import { create } from 'zustand';
import { api, unwrap } from './api';

export interface StoreCandidate {
  storeId: string;
  storeName: string;
  storeCode: string;
  province: string;
  district: string | null;
  distanceKm: number | null;
  serviceable: boolean;
  reason: string;
}

export interface ResolveResult {
  serviceable: boolean;
  selectedStore: StoreCandidate | null;
  alternatives: StoreCandidate[];
  reason: string;
  message: string;
}

export interface SelectedStore {
  id: string;
  name: string;
  code: string;
  province: string;
  district: string | null;
}

interface StoreState {
  store: SelectedStore | null;
  resolving: boolean;
  lastReason: string | null;
  /** Resolve store theo dia chi/khu vuc; luu store duoc chon. */
  resolveByAddress: (addressId: string) => Promise<ResolveResult>;
  resolveByArea: (input: {
    lat?: number;
    lng?: number;
    province?: string;
    district?: string;
    ward?: string;
  }) => Promise<ResolveResult>;
  setStore: (s: SelectedStore | null) => void;
  clear: () => void;
}

const STORAGE_KEY = 'selectedStore';
const stored = localStorage.getItem(STORAGE_KEY);

function persist(s: SelectedStore | null) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_KEY);
}

export const useStoreContext = create<StoreState>((set) => ({
  store: stored ? JSON.parse(stored) : null,
  resolving: false,
  lastReason: null,

  resolveByAddress: async (addressId) => {
    set({ resolving: true });
    try {
      const result = await unwrap<ResolveResult>(
        api.post('/stores/resolve', { addressId }),
      );
      applyResult(set, result);
      return result;
    } finally {
      set({ resolving: false });
    }
  },

  resolveByArea: async (input) => {
    set({ resolving: true });
    try {
      const result = await unwrap<ResolveResult>(
        api.post('/stores/resolve', input),
      );
      applyResult(set, result);
      return result;
    } finally {
      set({ resolving: false });
    }
  },

  setStore: (s) => {
    persist(s);
    set({ store: s });
  },

  clear: () => {
    persist(null);
    set({ store: null, lastReason: null });
  },
}));

function applyResult(
  set: (s: Partial<StoreState>) => void,
  result: ResolveResult,
) {
  if (result.selectedStore) {
    const s: SelectedStore = {
      id: result.selectedStore.storeId,
      name: result.selectedStore.storeName,
      code: result.selectedStore.storeCode,
      province: result.selectedStore.province,
      district: result.selectedStore.district,
    };
    persist(s);
    set({ store: s, lastReason: result.reason });
  } else {
    set({ lastReason: result.reason });
  }
}
