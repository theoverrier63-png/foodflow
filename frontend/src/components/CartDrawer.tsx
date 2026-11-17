import { useEffect, useState } from "react";
import { X, ShoppingCart, Trash2, Plus, Minus, Info } from "lucide-react";
import { useCart } from "../cart";
import { formatQty, unitLabel, unitShort } from "../units";
import { api } from "../api";
import { useToast } from "./Toast";
import clsx from "clsx";

export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { items, inc, dec, remove, setQty, clear, count } = useCart();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function submit() {
    if (items.length === 0) return;
    setBusy(true);
    try {
      await api.createOrder(items, notes);
      toast.show("Commande envoyée", "success");
      clear();
      setNotes("");
      onClose();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={clsx(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-popup transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand-700" />
            <h2 className="text-base font-bold text-slate-900">Votre panier</h2>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
              {count}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400">
                <ShoppingCart size={24} />
              </div>
              <h3 className="font-semibold text-slate-700">Panier vide</h3>
              <p className="text-sm text-slate-500">
                Ajoutez des produits depuis le catalogue pour commencer votre commande.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((it) => (
                <li
                  key={it.product_id + it.sell_unit}
                  className="flex flex-col gap-2 px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{it.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Vendu {it.sell_unit === "kg" ? "au kilo" : it.sell_unit === "cagette" ? "à la cagette" : "à la pièce"} • {it.unit}
                      </div>
                    </div>
                    <button
                      className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => remove(it.product_id, it.sell_unit)}
                      aria-label="Retirer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => dec(it.product_id, it.sell_unit)}
                      className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                      aria-label="Diminuer"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-900">
                      <input
                        value={formatQty(it.quantity)}
                        onChange={(e) =>
                          setQty(
                            it.product_id,
                            it.sell_unit,
                            Number(e.target.value.replace(",", ".")) || 0,
                          )
                        }
                        inputMode={it.sell_unit === "kg" ? "decimal" : "numeric"}
                        className="w-16 bg-transparent text-center outline-none"
                      />
                      <span className="text-xs text-slate-500">
                        {unitShort(it.sell_unit)}
                      </span>
                    </div>
                    <button
                      onClick={() => inc(it.product_id, it.sell_unit)}
                      className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                      aria-label="Augmenter"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Note du client (optionnel)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
                placeholder="Horaire de livraison préféré, quai, etc."
              />
            </label>
            <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Info size={14} />
              <span>Facturation en dehors de l&apos;application</span>
            </div>
            <button
              onClick={submit}
              disabled={busy}
              className="w-full rounded-lg bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Envoi…" : `Valider la commande (${count} article${count > 1 ? "s" : ""})`}
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
