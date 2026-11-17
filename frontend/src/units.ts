import { Product, SellUnit } from "./api";

export function unitLabel(u: SellUnit, qty?: number): string {
  if (u === "kg") return "kg";
  if (u === "cagette") return (qty ?? 1) > 1 ? "cagettes" : "cagette";
  return (qty ?? 1) > 1 ? "pièces" : "pièce";
}

export function unitShort(u: SellUnit): string {
  if (u === "kg") return "kg";
  if (u === "cagette") return "cag.";
  return "pce";
}

export function stepFor(u: SellUnit): number {
  return u === "kg" ? 0.5 : 1;
}

export function parseQty(v: string): number {
  const n = parseFloat(v.replace(",", ".").trim());
  return isFinite(n) ? n : 0;
}

export function roundQty(q: number, u: SellUnit): number {
  if (u === "kg") return Math.max(0, Math.round(q * 2) / 2);
  return Math.max(0, Math.round(q));
}

export function formatQty(q: number): string {
  const n = Number(q);
  if (!isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

export function availableUnits(product: Product): SellUnit[] {
  const units: SellUnit[] = [];
  if (product.sell_by_kg) units.push("kg");
  if (product.sell_by_piece) units.push("piece");
  const hasCagette =
    (product.cagette_content_pieces != null && product.cagette_content_pieces > 0) ||
    (product.cagette_content_kg != null && product.cagette_content_kg > 0);
  if (hasCagette) units.push("cagette");
  if (units.length === 0) units.push((product.sell_unit as SellUnit) || "piece");
  return units;
}

export function cagetteContentLabel(product: Product): string | null {
  if (product.cagette_content_pieces != null && product.cagette_content_pieces > 0)
    return `${product.cagette_content_pieces} pce / cagette`;
  if (product.cagette_content_kg != null && product.cagette_content_kg > 0)
    return `${product.cagette_content_kg} kg / cagette`;
  return null;
}
