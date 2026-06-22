import { create } from 'zustand';
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

const itemKey = (id: string, variantId?: string | null) => `${id}:${variantId ?? ''}`;
const cartStorageKey = (userId: string) => `cart-v2-${userId}`;

let _currentUserId: string | null = null;

export const useCart = create<CartStore>((set, get) => ({
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
    set((state) => ({
      items: state.items.filter((i) => itemKey(i.id, i.variantId) !== itemKey(id, variantId)),
    })),
  updateQuantity: (id, change, variantId) =>
    set((state) => ({
      items: state.items.map((i) =>
        itemKey(i.id, i.variantId) === itemKey(id, variantId)
          ? { ...i, quantity: Math.max(1, i.quantity + change) }
          : i
      ),
    })),
  clearCart: () => set({ items: [] }),
}));

// Auto-persist to the current user's scoped key on every state change
useCart.subscribe((state) => {
  if (!_currentUserId) return;
  const uid = _currentUserId;
  storage.setItem(cartStorageKey(uid), JSON.stringify(state.items)).catch(() => {});
});

/**
 * Load the cart for a specific user from their scoped storage key.
 * Call this after login and on app startup when a session already exists.
 */
export async function initCartForUser(userId: string): Promise<void> {
  _currentUserId = userId;
  try {
    const raw = await storage.getItem(cartStorageKey(userId));
    const items: CartItem[] = raw ? JSON.parse(raw) : [];
    useCart.setState({ items });
  } catch {
    useCart.setState({ items: [] });
  }
}

/**
 * Clear the in-memory cart and remove the user's persisted cart.
 * Call this on logout.
 */
export async function clearCartForUser(userId: string): Promise<void> {
  useCart.setState({ items: [] });
  _currentUserId = null;
  try {
    await storage.removeItem(cartStorageKey(userId));
  } catch {}
}
