import { useEffect, useState } from "react";
import { api, downloadAuthedFile, Order } from "../../api";
import { Link } from "react-router-dom";
import { useToast } from "../../components/Toast";
import { Download, Loader2 } from "lucide-react";

export default function AdminOrders() {
  const [tab, setTab] = useState<"all" | "business" | "personal">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    api
      .adminOrders(tab === "all" ? undefined : tab)
      .then(setOrders)
      .catch((e) => toast.show(e?.message, "error"))
      .finally(() => setLoading(false));
  }, [tab, toast]);

  async function exportAll() {
    try {
      const res = await api.adminExportAll();
      const blob = new Blob([res.content], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.filename;
      a.click();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Commandes</h1>
        <button
          onClick={exportAll}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download size={14} /> Exporter CSV
        </button>
      </div>

      <div className="flex gap-2">
        {([
          { k: "all", l: "Toutes" },
          { k: "business", l: "Pro" },
          { k: "personal", l: "Particuliers" },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-semibold transition " +
              (tab === t.k
                ? "bg-brand-700 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100")
            }
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid min-h-[200px] place-items-center">
          <Loader2 className="animate-spin text-brand-700" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Aucune commande.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                    #{o.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{o.company_name}</div>
                    <div className="text-xs text-slate-500">{o.delivery_address}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {o.account_type === "business" ? "Pro" : "Particulier"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{o.items.length}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(o.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          downloadAuthedFile(
                            api.adminInvoice(o.id),
                            `bon-commande-${o.id.slice(0, 8)}.pdf`,
                          ).catch((e) => toast.show(e?.message || "Erreur", "error"))
                        }
                        className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-brand-700 hover:text-brand-700"
                        title="Télécharger le bon PDF"
                      >
                        <Download size={14} />
                      </button>
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
                      >
                        Gérer
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
