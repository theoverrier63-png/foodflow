import { useEffect, useState } from "react";
import { api, User } from "../../api";
import { useToast } from "../../components/Toast";
import { Loader2, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";

export default function Clients() {
  const [items, setItems] = useState<Array<User & { created_at?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      setItems(await api.adminBusinessUsers());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function revoke(u: User) {
    if (!confirm(`Révoquer l'accès de ${u.company_name} ?`)) return;
    try {
      await api.adminRevokeUser(u.id);
      toast.show("Accès révoqué", "success");
      load();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  async function restore(u: User) {
    try {
      await api.adminRestoreUser(u.id);
      toast.show("Accès rétabli", "success");
      load();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  async function del(u: User) {
    if (!confirm(`Supprimer définitivement ${u.company_name} ?`)) return;
    try {
      await api.adminDeleteUser(u.id);
      toast.show("Supprimé", "success");
      load();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Clients professionnels</h1>

      {loading ? (
        <div className="grid min-h-[200px] place-items-center">
          <Loader2 className="animate-spin text-brand-700" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Aucun client Pro pour l&apos;instant.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Société</th>
                <th className="px-4 py-3">SIRET</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{u.company_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.siret}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.phone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-semibold " +
                        (u.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : u.status === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700")
                      }
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.status === "approved" ? (
                        <button
                          onClick={() => revoke(u)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          <ShieldOff size={12} /> Révoquer
                        </button>
                      ) : (
                        <button
                          onClick={() => restore(u)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          <ShieldCheck size={12} /> Rétablir
                        </button>
                      )}
                      <button
                        onClick={() => del(u)}
                        className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={12} />
                      </button>
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
