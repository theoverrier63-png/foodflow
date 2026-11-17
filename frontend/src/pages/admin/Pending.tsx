import { useEffect, useState } from "react";
import { api, User } from "../../api";
import { useToast } from "../../components/Toast";
import { Check, X, Loader2 } from "lucide-react";

export default function Pending() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      setItems(await api.adminPending());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function approve(u: User) {
    try {
      await api.adminApprove(u.id);
      toast.show("Compte approuvé", "success");
      load();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }
  async function reject(u: User) {
    try {
      await api.adminReject(u.id);
      toast.show("Compte rejeté", "success");
      load();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Comptes à valider</h1>

      {loading ? (
        <div className="grid min-h-[200px] place-items-center">
          <Loader2 className="animate-spin text-brand-700" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Aucun compte en attente de validation.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((u) => (
            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="font-bold text-slate-900">{u.company_name}</div>
              <div className="mt-1 text-sm text-slate-600">{u.email} · {u.phone}</div>
              <div className="mt-1 text-xs text-slate-500">SIRET : {u.siret}</div>
              <div className="mt-1 text-xs text-slate-500">{u.delivery_address}</div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => approve(u)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Check size={12} /> Approuver
                </button>
                <button
                  onClick={() => reject(u)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <X size={12} /> Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
