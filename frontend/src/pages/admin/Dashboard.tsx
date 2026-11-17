import { useEffect, useState } from "react";
import { api, Order, User } from "../../api";
import { Link } from "react-router-dom";
import { Clock, Package, UserPlus, Loader2 } from "lucide-react";

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pending, setPending] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, p] = await Promise.all([api.adminOrders(), api.adminPending()]);
        setOrders(o);
        setPending(p);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <div className="grid min-h-[300px] place-items-center">
        <Loader2 className="animate-spin text-brand-700" />
      </div>
    );

  const pendingOrders = orders.filter((o) => o.status === "En attente").length;
  const latest = orders.slice(0, 6);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Tableau de bord</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi icon={Package} label="Commandes totales" value={orders.length} tone="brand" />
        <Kpi icon={Clock} label="En attente" value={pendingOrders} tone="amber" />
        <Kpi icon={UserPlus} label="Pro à valider" value={pending.length} tone="blue" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Dernières commandes</h2>
          <Link to="/admin/orders" className="text-sm font-semibold text-brand-700 hover:underline">
            Tout voir →
          </Link>
        </div>
        {latest.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Aucune commande récente.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Articles</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latest.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{o.company_name}</td>
                    <td className="px-4 py-3 text-slate-600">{o.items.length}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(o.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Détails
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "brand" | "amber" | "blue";
}) {
  const colors = {
    brand: "bg-brand-700 text-white",
    amber: "bg-amber-500 text-white",
    blue: "bg-blue-600 text-white",
  }[tone];
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className={"grid h-12 w-12 place-items-center rounded-lg " + colors}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}
