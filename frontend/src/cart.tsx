import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { CartItem, Product, SellUnit } from "./api";
import { availableUnits, roundQty, stepFor } from "./units";

const STORAGE_KEY = "lp_cart_v2";

type Ctx = {
  items: CartItem[];
  count: number;
  add: (p: Product, quantity?: number, unit?: SellUnit) => void;
  setQty: (productId: string, unit: SellUnit, quantity: number) => void;
  inc: (productId: string, unit: SellUnit) => void;
  dec: (productId: string, unit: SellUnit) => void;
  remove: (productId: string, unit: SellUnit) => void;
  clear: () => void;
};

const CartCtx = createContext<Ctx | null>(null);

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = useCallback((p: Product, quantity = 1, unit?: SellUnit) => {
    const units = availableUnits(p);
    const chosen: SellUnit = unit && units.includes(unit) ? unit : units[0];
    const q = roundQty(quantity, chosen);
    if (q <= 0) return;
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.product_id === p.id && i.sell_unit === chosen,
      );
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id && i.sell_unit === chosen
            ? { ...i, quantity: roundQty(i.quantity + q, chosen) }
            : i,
        );
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          unit: p.unit,
          sell_unit: chosen,
          quantity: q,
        },
      ];
    });
  }, []);

  const setQty = useCallback((productId: string, unit: SellUnit, quantity: number) => {
    setItems((prev) => {
      const match = prev.find((i) => i.product_id === productId && i.sell_unit === unit);
      if (!match) return prev;
      const q = roundQty(quantity, unit);
      if (q <= 0)
        return prev.filter((i) => !(i.product_id === productId && i.sell_unit === unit));
      return prev.map((i) =>
        i.product_id === productId && i.sell_unit === unit ? { ...i, quantity: q } : i,
      );
    });
  }, []);

  const inc = useCallback((productId: string, unit: SellUnit) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId && i.sell_unit === unit
          ? { ...i, quantity: roundQty(i.quantity + stepFor(unit), unit) }
          : i,
      ),
    );
  }, []);

  const dec = useCallback((productId: string, unit: SellUnit) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.product_id === productId && i.sell_unit === unit
            ? { ...i, quantity: roundQty(i.quantity - stepFor(unit), unit) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const remove = useCallback((productId: string, unit: SellUnit) => {
    setItems((prev) =>
      prev.filter((i) => !(i.product_id === productId && i.sell_unit === unit)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.length, [items]);

  return (
    <CartCtx.Provider value={{ items, count, add, setQty, inc, dec, remove, clear }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
