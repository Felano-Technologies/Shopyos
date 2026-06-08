import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/services/storage';

type Product = {
  id: string;
  title: string;
  category: string;
  price: number;
  image: any;
  storeId?: string;
  variantId?: string | null;
  variantAttributes?: Record<string, string>;
};

type CartItem = Product & { quantity: number };

type CartStore = {
  items: CartItem[];
  cartCount: number;
  addToCart: (product: Product) => void;
  removeFromCart: (id: string, variantId?: string | null) => void;
  updateQuantity: (id: string, change: number, variantId?: string | null) => void;
  clearCart: () => void;
};

// Each (productId, variantId) pair is a unique line item
const itemKey = (id: string, variantId?: string | null) => `${id}:${variantId ?? ''}`;

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      get cartCount() {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
      addToCart: (product) =>
        set((state) => {
          const key = itemKey(product.id, product.variantId);
          const existing = state.items.find((i) => itemKey(i.id, i.variantId) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                itemKey(i.id, i.variantId) === key ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...product, quantity: 1 }] };
        }),
      removeFromCart: (id, variantId) =>
        set((state) => {
          const key = itemKey(id, variantId);
          return { items: state.items.filter((i) => itemKey(i.id, i.variantId) !== key) };
        }),
      updateQuantity: (id, change, variantId) =>
        set((state) => {
          const key = itemKey(id, variantId);
          return {
            items: state.items.map((i) =>
              itemKey(i.id, i.variantId) === key ? { ...i, quantity: Math.max(1, i.quantity + change) } : i
            ),
          };
        }),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => storage),
    }
  )
);
