// Display + parsing helpers for the "kg" or "piece" sell unit.

export type SellUnit = "kg" | "piece";

export function unitLabel(sellUnit: SellUnit, quantity = 1): string {
  if (sellUnit === "kg") return "kg";
  return quantity > 1 ? "pièces" : "pièce";
}

// Short version used in tight spots (cart / catalog price line).
export function unitShort(sellUnit: SellUnit): string {
  return sellUnit === "kg" ? "kg" : "pce";
}

// Format a number as a French-locale quantity like "2,5" or "3".
export function formatQty(q: number): string {
  const rounded = Math.round(q * 1000) / 1000;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(rounded.toString().split(".")[1]?.length > 2 ? 2 : 1).replace(".", ",");
}

// Parse a user-typed quantity that may use "," instead of "." (French keyboards).
export function parseQty(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(",", ".").trim());
  return isFinite(n) && n > 0 ? n : 0;
}

// Default increment/decrement step depending on the unit.
export function stepFor(sellUnit: SellUnit): number {
  return sellUnit === "kg" ? 0.5 : 1;
}

// Round to a sane precision for the unit.
export function roundQty(q: number, sellUnit: SellUnit): number {
  if (sellUnit === "piece") return Math.max(0, Math.round(q));
  return Math.max(0, Math.round(q * 100) / 100);
}
