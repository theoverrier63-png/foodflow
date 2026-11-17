import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Mail, Loader2 } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
      toast.show("Si votre email est reconnu, un lien va vous être envoyé", "success");
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
          <Mail size={22} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nous vous enverrons un lien pour réinitialiser votre mot de passe.
        </p>

        {sent ? (
          <div className="mt-6 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
            Si cet email est associé à un compte, vous recevrez un email avec un lien de réinitialisation sous quelques minutes.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
                placeholder="contact@entreprise.fr"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {busy && <Loader2 className="animate-spin" size={16} />}
              Envoyer le lien
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
