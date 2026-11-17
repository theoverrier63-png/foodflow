import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, MapPin, Plus, Minus, Loader2, ShoppingCart } from "lucide-react";
import { api, Product, SellUnit } from "../api";
import { availableUnits, cagetteContentLabel, formatQty, parseQty, roundQty, stepFor, unitLabel } from "../units";
import { useCart } from "../cart";
import { useToast } from "../components/Toast";
import clsx from "clsx";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState<SellUnit>("piece");
  const { add } = useCart();
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await api.getProduct(id);
        setProduct(p);
        const u = availableUnits(p);
        setUnit(u.includes(p.sell_unit as SellUnit) ? (p.sell_unit as SellUnit) : u[0]);
      } catch (e: any) {
        toast.show(e?.message || "Produit introuvable", "error");
        nav(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, nav, toast]);

  if (loading) {
    return (
      <div className="grid min-h-[300px] place-items-center">
        <Loader2 className="animate-spin text-brand-700" />
      </div>
    );
  }
  if (!product) return null;

  const units = availableUnits(product);
  const step = stepFor(unit);
  const q = roundQty(parseQty(qty), unit);
  const cagLabel = cagetteContentLabel(product);

  function bump(delta: number) {
    const n = roundQty(Math.max(0, q + delta), unit);
    setQty(n > 0 ? formatQty(n) : "0");
  }

  function handleAdd() {
    if (q <= 0) return toast.show("Saisissez une quantité", "error");
    add(product!, q, unit);
    toast.show(`${product!.name} ajouté — ${formatQty(q)} ${unitLabel(unit, q)}`, "success");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Link
        to="/"
        className="col-span-full inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700"
      >
        <ChevronLeft size={16} /> Retour au catalogue
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <img
          src={product.image_url}
          alt={product.name}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>

      <div className="space-y-6">
        <div>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-700">
            {product.category}
          </span>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{product.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPin size={13} /> {product.origin}
            <span className="mx-2">•</span>
            <span>{product.unit}</span>
          </div>
        </div>

        <section>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Description
          </h2>
          <p className="text-sm leading-relaxed text-slate-700">
            {product.description || "Aucune description disponible pour ce produit."}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Unité de vente
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["kg", "piece", "cagette"] as SellUnit[]).map((u) => {
              const available = units.includes(u);
              const labels: Record<SellUnit, string> = {
                kg: "Au kilo",
                piece: "À la pièce",
                cagette: "À la cagette",
              };
              const active = unit === u;
              return (
                <button
                  key={u}
                  onClick={() => {
                    if (!available) return;
                    setUnit(u);
                    setQty("1");
                  }}
                  disabled={!available}
                  className={clsx(
                    "min-w-[150px] rounded-lg border px-4 py-3 text-left transition",
                    active && "border-brand-700 bg-brand-700 text-white",
                    !active && available && "border-slate-200 bg-white hover:border-brand-700",
                    !available && "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-400",
                  )}
                >
                  <div className="text-sm font-semibold">{labels[u]}</div>
                  {u === "cagette" && cagLabel && (
                    <div className={clsx("text-xs", active ? "text-white/80" : "text-slate-500")}>
                      {cagLabel}
                    </div>
                  )}
                  {!available && <div className="text-[11px] text-slate-400">Non proposé</div>}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Quantité
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => bump(-step)}
              className="grid h-12 w-12 place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            >
              <Minus size={16} />
            </button>
            <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode={unit === "kg" ? "decimal" : "numeric"}
                className="w-24 bg-transparent text-center text-xl font-bold outline-none"
              />
              <span className="text-sm text-slate-500">{unitLabel(unit, q)}</span>
            </div>
            <button
              onClick={() => bump(step)}
              className="grid h-12 w-12 place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </section>

        <button
          onClick={handleAdd}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <ShoppingCart size={16} />
          Ajouter au panier
        </button>
      </div>
    </div>
  );
}
