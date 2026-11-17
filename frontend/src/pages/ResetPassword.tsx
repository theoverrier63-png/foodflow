import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ChevronLeft, Loader2 } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Toast";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.show("Minimum 8 caractères", "error");
    if (password !== confirm) return toast.show("Les mots de passe ne correspondent pas", "error");
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      toast.show("Mot de passe mis à jour. Connectez-vous.", "success");
      nav("/login", { replace: true });
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <Link to="/login" className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ChevronLeft size={16} /> Retour à la connexion
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-lg bg-brand-50 text-brand-700">
          <Lock size={22} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-slate-500">Choisissez un nouveau mot de passe sécurisé.</p>

        {!token ? (
          <div className="mt-6 rounded-md bg-rose-50 p-4 text-sm text-rose-800">
            Lien invalide. Veuillez redemander un email de réinitialisation.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Nouveau mot de passe</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Confirmer</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {busy && <Loader2 className="animate-spin" size={16} />}
              Enregistrer
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
