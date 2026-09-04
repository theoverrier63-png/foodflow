import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CartItem, Product } from "./api";

type CartCtx = {
  items: CartItem[];
  count: number;
  total: number;
  add: (p: Product) => void;
  inc: (productId: string) => void;
  dec: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((p: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { product_id: p.id, name: p.name, unit: p.unit, price: p.price, quantity: 1 },
      ];
    });
  }, []);

  const inc = useCallback((productId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i))
    );
  }, []);

  const dec = useCallback((productId: string) => {
    setItems((prev) =>
      prev
        .map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((a, i) => a + i.quantity, 0), [items]);
  const total = useMemo(
    () => Math.round(items.reduce((a, i) => a + i.price * i.quantity, 0) * 100) / 100,
    [items]
  );

  return (
    <CartContext.Provider value={{ items, count, total, add, inc, dec, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
