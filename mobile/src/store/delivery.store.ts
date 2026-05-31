import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Address, ResolveStoreResult, StoreCandidate } from '../types';
import { storesApi } from '../lib/api/stores.api';
import { getCurrentCoords } from '../lib/location';

/**
 * Delivery context cho Customer. Backend la source of truth cho store assignment.
 * Store nay chi cache ket qua resolve gan nhat (autoAssignedStore) de hien thi
 * product list/availability. Checkout LUON resolve lai tu dia chi cuoi.
 */
const LAST_CONTEXT_KEY = 'nsx.deliveryContext';

export type ResolveSource = 'address' | 'gps' | 'manual' | 'none';

interface PersistedContext {
  storeId: string | null;
  storeName: string | null;
  source: ResolveSource;
  addressId: string | null;
}

interface DeliveryState {
  /** Cua hang he thong tu gan (KHONG cho user ep chon). */
  store: StoreCandidate | null;
  /** Dia chi dang dung lam ngu canh (neu resolve bang addressId). */
  activeAddress: Address | null;
  source: ResolveSource;
  lastResult: ResolveStoreResult | null;
  resolving: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  resolveByAddress: (address: Address) => Promise<ResolveStoreResult>;
  resolveByCoords: (lat: number, lng: number) => Promise<ResolveStoreResult>;
  resolveByCurrentGps: () => Promise<ResolveStoreResult | null>;
  resolveByManual: (input: { province: string; district: string; ward: string }) => Promise<ResolveStoreResult>;
  reset: () => void;
}

async function persist(ctx: PersistedContext) {
  await AsyncStorage.setItem(LAST_CONTEXT_KEY, JSON.stringify(ctx));
}

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  store: null,
  activeAddress: null,
  source: 'none',
  lastResult: null,
  resolving: false,
  error: null,

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(LAST_CONTEXT_KEY);
      if (!raw) return;
      const ctx = JSON.parse(raw) as PersistedContext;
      // Chi khoi phuc source/addressId; store thuc te se resolve lai khi can.
      set({ source: ctx.source, store: ctx.storeId ? get().store : null });
    } catch {
      // ignore
    }
  },

  async resolveByAddress(address) {
    set({ resolving: true, error: null });
    try {
      const result = await storesApi.resolve({ addressId: address.id });
      set({
        store: result.selectedStore,
        activeAddress: address,
        source: 'address',
        lastResult: result,
        resolving: false,
      });
      await persist({
        storeId: result.selectedStore?.storeId ?? null,
        storeName: result.selectedStore?.storeName ?? null,
        source: 'address',
        addressId: address.id,
      });
      return result;
    } catch (e) {
      set({ resolving: false, error: (e as Error).message });
      throw e;
    }
  },

  async resolveByCoords(lat, lng) {
    set({ resolving: true, error: null });
    try {
      const result = await storesApi.resolve({ lat, lng });
      set({
        store: result.selectedStore,
        activeAddress: null,
        source: 'gps',
        lastResult: result,
        resolving: false,
      });
      await persist({
        storeId: result.selectedStore?.storeId ?? null,
        storeName: result.selectedStore?.storeName ?? null,
        source: 'gps',
        addressId: null,
      });
      return result;
    } catch (e) {
      set({ resolving: false, error: (e as Error).message });
      throw e;
    }
  },

  async resolveByCurrentGps() {
    const coords = await getCurrentCoords();
    if (!coords) return null;
    return get().resolveByCoords(coords.lat, coords.lng);
  },

  async resolveByManual(input) {
    set({ resolving: true, error: null });
    try {
      const result = await storesApi.resolve(input);
      set({
        store: result.selectedStore,
        activeAddress: null,
        source: 'manual',
        lastResult: result,
        resolving: false,
      });
      await persist({
        storeId: result.selectedStore?.storeId ?? null,
        storeName: result.selectedStore?.storeName ?? null,
        source: 'manual',
        addressId: null,
      });
      return result;
    } catch (e) {
      set({ resolving: false, error: (e as Error).message });
      throw e;
    }
  },

  reset() {
    set({ store: null, activeAddress: null, source: 'none', lastResult: null, error: null });
    void AsyncStorage.removeItem(LAST_CONTEXT_KEY);
  },
}));
