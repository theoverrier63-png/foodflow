import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CartItem, Product } from "./api";
import { roundQty, stepFor, SellUnit } from "./units";

// Which sell units the client can choose for a given product.
// - kg / piece come from the admin-side booleans (sell_by_kg / sell_by_piece).
// - cagette is available whenever cagette content is filled in (pieces or kg).
export function availableUnits(product: Product): SellUnit[] {
  const units: SellUnit[] = [];
  if (product.sell_by_kg) units.push("kg");
  if (product.sell_by_piece) units.push("piece");
  const hasCagette =
    (product.cagette_content_pieces != null && product.cagette_content_pieces > 0) ||
    (product.cagette_content_kg != null && product.cagette_content_kg > 0);
  if (hasCagette) units.push("cagette");
  // Fallback for legacy products that only carry sell_unit
  if (units.length === 0) {
    units.push((product.sell_unit as SellUnit) || "piece");
  }
  return units;
}

// Human-readable description of what a cagette contains (e.g. "24 pce / cagette").
export function cagetteContentLabel(product: Product): string | null {
  if (product.cagette_content_pieces != null && product.cagette_content_pieces > 0) {
    return `${product.cagette_content_pieces} pce / cagette`;
  }
  if (product.cagette_content_kg != null && product.cagette_content_kg > 0) {
    return `${product.cagette_content_kg} kg / cagette`;
  }
  return null;
}

type CartCtx = {
  items: CartItem[];
  count: number;
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
    const units = availableUnits(p);
    const chosenUnit: SellUnit = unit && units.includes(unit) ? unit : units[0];
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

  return (
    <CartContext.Provider value={{ items, count, add, setQty, inc, dec, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
