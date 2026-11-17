import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, downloadAuthedFile, Order } from "../../api";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { formatQty, unitShort } from "../../units";
import { useToast } from "../../components/Toast";

const STATUSES = ["En attente", "Validée", "En préparation", "Livrée", "Annulée"];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    api
      .adminGetOrder(id)
      .then(setOrder)
      .catch((e) => toast.show(e?.message, "error"))
      .finally(() => setLoading(false));
  }, [id, toast]);

  async function changeStatus(s: string) {
    if (!order) return;
    setSaving(true);
    try {
      const updated = await api.adminUpdateStatus(order.id, s);
      setOrder(updated);
      toast.show(`Statut : ${s}`, "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="grid min-h-[300px] place-items-center">
        <Loader2 className="animate-spin text-brand-700" />
      </div>
    );
  if (!order) return null;

  const totalItems = order.items.reduce((a, i) => a + i.quantity, 0);

  return (
    <div className="space-y-6">
      <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ChevronLeft size={16} /> Retour aux commandes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Commande #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-sm text-slate-500">
            {new Date(order.created_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <button
          onClick={() =>
            downloadAuthedFile(
              api.adminInvoice(order.id),
              `bon-commande-${order.id.slice(0, 8)}.pdf`,
            ).catch((e) => toast.show(e?.message || "Erreur", "error"))
          }
          className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <Download size={14} /> Bon de commande
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client</h3>
          <div className="mt-2 font-bold text-slate-900">{order.company_name}</div>
          <div className="mt-1 text-sm text-slate-600">{order.delivery_address}</div>
          <div className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {order.account_type === "business" ? "Pro" : "Particulier"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</h3>
          <select
            value={order.status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={saving}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Récapitulatif
          </h3>
          <div className="mt-2 flex items-center justify-between text-sm text-slate-700">
            <span>Références</span> <strong>{order.items.length}</strong>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm text-slate-700">
            <span>Total unités</span> <strong>{formatQty(totalItems)}</strong>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Format</th>
              <th className="px-4 py-3 text-right">Quantité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((it) => (
              <tr key={it.product_id + it.sell_unit}>
                <td className="px-4 py-3 font-medium text-slate-900">{it.name}</td>
                <td className="px-4 py-3 text-slate-600">{it.unit}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatQty(it.quantity)} {unitShort(it.sell_unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Note du client
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
