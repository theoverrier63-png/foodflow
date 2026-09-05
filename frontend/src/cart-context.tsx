import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CartItem, Product } from "./api";
import { roundQty, stepFor } from "./units";

type CartCtx = {
  items: CartItem[];
  count: number;
  total: number;
  add: (p: Product, quantity?: number) => void;
  setQty: (productId: string, quantity: number) => void;
  inc: (productId: string) => void;
  dec: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((p: Product, quantity = 1) => {
    const q = roundQty(quantity, p.sell_unit);
    if (q <= 0) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id
            ? { ...i, quantity: roundQty(i.quantity + q, p.sell_unit) }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          unit: p.unit,
          sell_unit: p.sell_unit,
          price: p.price,
          quantity: q,
        },
      ];
    });
  }, []);

  const setQty = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.product_id === productId);
      if (!item) return prev;
      const q = roundQty(quantity, item.sell_unit);
      if (q <= 0) return prev.filter((i) => i.product_id !== productId);
      return prev.map((i) => (i.product_id === productId ? { ...i, quantity: q } : i));
    });
  }, []);

  const inc = useCallback((productId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId
          ? { ...i, quantity: roundQty(i.quantity + stepFor(i.sell_unit), i.sell_unit) }
          : i
      )
    );
  }, []);

  const dec = useCallback((productId: string) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.product_id === productId
            ? { ...i, quantity: roundQty(i.quantity - stepFor(i.sell_unit), i.sell_unit) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.length, [items]);
  const total = useMemo(
    () => Math.round(items.reduce((a, i) => a + i.price * i.quantity, 0) * 100) / 100,
    [items]
  );

  return (
    <CartContext.Provider value={{ items, count, total, add, setQty, inc, dec, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
