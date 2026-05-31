import { create } from 'zustand';
import { api, unwrap, getSessionId } from './api';

export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  name: string;
  sku: string;
  unit: string;
  image: string | null;
  unitPrice: number;
  originalPrice: number;
  onSale: boolean;
  quantity: number;
  available: number;
  inStock: boolean;
  lineTotal: number;
}

interface CartView {
  cartId: string;
  storeId: string | null;
  storeName: string | null;
  items: CartItem[];
  subtotal: number;
  count: number;
  hasIssues: boolean;
}

interface CartState {
  items: CartItem[];
  storeId: string | null;
  storeName: string | null;
  subtotal: number;
  count: number;
  hasIssues: boolean;
  loading: boolean;
  fetch: () => Promise<void>;
  add: (storeId: string, variantId: string, quantity: number) => Promise<void>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
}

function apply(set: (s: Partial<CartState>) => void, view: CartView) {
  set({
    items: view.items,
    storeId: view.storeId,
    storeName: view.storeName,
    subtotal: view.subtotal,
    count: view.count ?? view.items.reduce((s, i) => s + i.quantity, 0),
    hasIssues: view.hasIssues,
  });
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  storeId: null,
  storeName: null,
  subtotal: 0,
  count: 0,
  hasIssues: false,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const view = await unwrap<CartView>(
        api.get('/cart', { headers: { 'X-Session-Id': getSessionId() } }),
      );
      apply(set, view);
    } finally {
      set({ loading: false });
    }
  },
  add: async (storeId, variantId, quantity) => {
    const view = await unwrap<CartView>(
      api.post('/cart/items', { storeId, variantId, quantity }),
    );
    apply(set, view);
  },
  update: async (itemId, quantity) => {
    const view = await unwrap<CartView>(
      api.patch(`/cart/items/${itemId}`, { quantity }),
    );
    apply(set, view);
  },
  remove: async (itemId) => {
    const view = await unwrap<CartView>(api.delete(`/cart/items/${itemId}`));
    apply(set, view);
  },
}));
