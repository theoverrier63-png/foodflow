import { useEffect, useState } from "react";
import { api, downloadAuthedFile, Order } from "../api";
import { formatQty, unitShort } from "../units";
import { useToast } from "../components/Toast";
import { Download, Loader2, Package } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "En attente": "bg-amber-100 text-amber-800",
  "Validée": "bg-blue-100 text-blue-800",
  "En préparation": "bg-indigo-100 text-indigo-800",
  "Livrée": "bg-emerald-100 text-emerald-800",
  "Annulée": "bg-rose-100 text-rose-800",
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        setOrders(await api.orders());
      } catch (e: any) {
        toast.show(e?.message || "Erreur", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  async function download(o: Order) {
    try {
      await downloadAuthedFile(
        api.customerInvoice(o.id),
        `bon-commande-${o.id.slice(0, 8)}.pdf`,
      );
      toast.show("Bon de commande téléchargé", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  if (loading)
    return (
      <div className="grid min-h-[300px] place-items-center">
        <Loader2 className="animate-spin text-brand-700" />
      </div>
    );

  if (orders.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <Package className="mx-auto text-slate-300" size={40} />
        <h2 className="mt-4 text-lg font-semibold text-slate-700">
          Aucune commande pour l&apos;instant
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Vos commandes s&apos;afficheront ici dès leur envoi.
        </p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mes commandes</h1>
        <p className="text-sm text-slate-500">Historique de vos commandes passées.</p>
      </div>

      <div className="grid gap-4">
        {orders.map((o) => (
          <div
            key={o.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900">
                  Commande #{o.id.slice(0, 8).toUpperCase()}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(o.created_at).toLocaleString("fr-FR")}
                </div>
              </div>
              <span
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold " +
                  (STATUS_COLORS[o.status] || "bg-slate-100 text-slate-700")
                }
              >
                {o.status}
              </span>
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {o.items.slice(0, 4).map((it) => (
                <li key={it.product_id + it.sell_unit} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-[70px] font-semibold text-brand-700">
                    {formatQty(it.quantity)} {unitShort(it.sell_unit)}
                  </span>
                  <span className="flex-1 truncate text-slate-700">{it.name}</span>
                </li>
              ))}
              {o.items.length > 4 && (
                <li className="pt-2 text-xs text-slate-400">
                  +{o.items.length - 4} autres articles
                </li>
              )}
            </ul>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {o.items.length} produit{o.items.length > 1 ? "s" : ""}
              </div>
              <button
                onClick={() => download(o)}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-700 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                <Download size={13} /> Bon PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
