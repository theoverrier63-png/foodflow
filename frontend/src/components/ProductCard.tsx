import { Link } from "react-router-dom";
import { Product, SellUnit } from "../api";
import { useCart } from "../cart";
import { useToast } from "./Toast";
import { availableUnits, cagetteContentLabel, unitLabel } from "../units";
import { MapPin, Plus } from "lucide-react";

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const toast = useToast();
  const units = availableUnits(product);
  const defaultUnit: SellUnit = units[0];

  function quickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    add(product, 1, defaultUnit);
    toast.show(`${product.name} ajouté`, "success");
  }

  const cagLabel = cagetteContentLabel(product);

  return (
    <Link
      to={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.03]"
        />
        <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
          {product.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-1 font-semibold text-slate-900">{product.name}</h3>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin size={11} /> {product.origin} <span className="mx-1">•</span> {product.unit}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {units.map((u) => (
            <span
              key={u}
              className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700"
            >
              {unitLabel(u)}
            </span>
          ))}
        </div>
        {cagLabel && (
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">{cagLabel}</div>
        )}
        <button
          onClick={quickAdd}
          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-700 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
    </Link>
  );
}
