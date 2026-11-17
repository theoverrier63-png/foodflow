import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { LogOut, Trash2, User as UserIcon, Building2 } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  if (!user) return null;

  async function handleDelete() {
    if (!confirm("Supprimer définitivement votre compte ? Cette action est irréversible.")) return;
    try {
      await api.deleteMe();
      logout();
      toast.show("Compte supprimé", "success");
      nav("/login", { replace: true });
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Mon compte</h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700">
            {user.account_type === "business" ? <Building2 size={22} /> : <UserIcon size={22} />}
          </span>
          <div>
            <div className="font-bold text-slate-900">{user.company_name}</div>
            <div className="text-xs text-slate-500">
              {user.account_type === "business" ? "Compte professionnel" : "Compte particulier"}
              {user.status && user.status !== "approved" && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                  En attente
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="Email" value={user.email} />
          <Info label="Téléphone" value={user.phone} />
          {user.siret && <Info label="SIRET" value={user.siret} />}
          <Info label="Adresse de livraison" value={user.delivery_address} className="sm:col-span-2" />
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            logout();
            nav("/login", { replace: true });
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut size={14} /> Déconnexion
        </button>
        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
        >
          <Trash2 size={14} /> Supprimer mon compte
        </button>
      </div>
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
