// context/CartContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// Define Item Types
type Product = {
  id: string;
  title: string;
  category: string;
  price: number;
  image: any;
};

type CartItem = Product & { quantity: number };

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, change: number) => void;
  clearCart: () => void;
  cartCount: number;
};

import { storage } from '../../services/api';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  // Load cart on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getItem('cart');
        if (stored) setItems(JSON.parse(stored));
      } catch (e) {
        console.log("Failed to load cart", e);
      }
    })();
  }, []);

  // Save cart on change
  useEffect(() => {
    storage.setItem('cart', JSON.stringify(items)).catch(e => console.log("Failed to save cart", e));
  }, [items]);

  const addToCart = (product: Product) => {
    setItems((prevItems) => {
      // Check if item exists
      const existing = prevItems.find((item) => item.id === product.id);
      if (existing) {
        // Increment quantity
        return prevItems.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Add new item
      return [...prevItems, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, change: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + change);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => setItems([]);

  // Total number of items (sum of quantities)
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};

// Dummy default export to prevent Expo Router warning
// This file should not be accessed as a route
export default function NotARoute() {
  return null;
}