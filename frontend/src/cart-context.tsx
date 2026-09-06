import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CartItem, Product, User } from "./api";
import { roundQty, stepFor, SellUnit } from "./units";

// HT prices (used for pros = "business" & admin)
export function priceForHt(product: Product, unit: SellUnit): number | null {
  if (unit === "kg") return product.price_kg ?? (product.sell_unit === "kg" ? product.price : null);
  if (unit === "cagette") return cagettePrice(product, "ht");
  return product.price_piece ?? (product.sell_unit === "piece" ? product.price : null);
}

// TTC prices (used for personal buyers). Fallback silently to HT if not filled yet.
export function priceForTtc(product: Product, unit: SellUnit): number | null {
  if (unit === "kg") return product.price_kg_ttc ?? priceForHt(product, unit);
  if (unit === "cagette") return cagettePrice(product, "ttc") ?? cagettePrice(product, "ht");
  return product.price_piece_ttc ?? priceForHt(product, unit);
}

// Compute the price of one full cagette from its content + unit price.
function cagettePrice(product: Product, mode: "ht" | "ttc"): number | null {
  const cp = product.cagette_content_pieces;
  const ck = product.cagette_content_kg;
  if (cp != null && cp > 0) {
    const p = mode === "ttc" ? product.price_piece_ttc ?? null : product.price_piece ?? null;
    return p != null ? Math.round(p * cp * 100) / 100 : null;
  }
  if (ck != null && ck > 0) {
    const p = mode === "ttc" ? product.price_kg_ttc ?? null : product.price_kg ?? null;
    return p != null ? Math.round(p * ck * 100) / 100 : null;
  }
  return null;
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

export type PriceMode = "ht" | "ttc";

export function priceModeFor(user?: Pick<User, "account_type"> | null): PriceMode {
  return user?.account_type === "personal" ? "ttc" : "ht";
}

export function priceLabelFor(mode: PriceMode): string {
  return mode === "ttc" ? "TTC" : "HT";
}

// Compute the price to actually display / bill for a given (product, unit, user).
export function priceFor(product: Product, unit: SellUnit, mode: PriceMode = "ht"): number | null {
  return mode === "ttc" ? priceForTtc(product, unit) : priceForHt(product, unit);
}

export function availableUnits(product: Product): SellUnit[] {
  const units: SellUnit[] = [];
  if (priceForHt(product, "kg") != null) units.push("kg");
  if (priceForHt(product, "piece") != null) units.push("piece");
  if (priceForHt(product, "cagette") != null) units.push("cagette");
  return units;
}

type CartCtx = {
  items: CartItem[];
  count: number;
  total: number;
  add: (p: Product, quantity?: number, unit?: SellUnit, mode?: PriceMode) => void;
  setQty: (productId: string, quantity: number) => void;
  inc: (productId: string) => void;
  dec: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((p: Product, quantity = 1, unit?: SellUnit, mode: PriceMode = "ht") => {
    const chosenUnit: SellUnit = unit ?? p.sell_unit;
    const price = priceFor(p, chosenUnit, mode);
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
