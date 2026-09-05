import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CartItem, Product } from "./api";
import { roundQty, stepFor, SellUnit } from "./units";

export function priceFor(product: Product, unit: SellUnit): number | null {
  if (unit === "kg") return product.price_kg ?? (product.sell_unit === "kg" ? product.price : null);
  return product.price_piece ?? (product.sell_unit === "piece" ? product.price : null);
}

export function availableUnits(product: Product): SellUnit[] {
  const units: SellUnit[] = [];
  if (priceFor(product, "kg") != null) units.push("kg");
  if (priceFor(product, "piece") != null) units.push("piece");
  return units;
}

type CartCtx = {
  items: CartItem[];
  count: number;
  total: number;
  add: (p: Product, quantity?: number, unit?: SellUnit) => void;
  setQty: (productId: string, quantity: number) => void;
  inc: (productId: string) => void;
  dec: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((p: Product, quantity = 1, unit?: SellUnit) => {
    const chosenUnit: SellUnit = unit ?? p.sell_unit;
    const price = priceFor(p, chosenUnit);
    if (price == null) return;
    const q = roundQty(quantity, chosenUnit);
    if (q <= 0) return;
    // A cart line is unique per (product, unit) pair — merge only if same unit
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.product_id === p.id && i.sell_unit === chosenUnit
      );
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id && i.sell_unit === chosenUnit
            ? { ...i, quantity: roundQty(i.quantity + q, chosenUnit) }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          unit: p.unit,
          sell_unit: chosenUnit,
          price,
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
