import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Store, ChevronLeft, Loader2 } from "lucide-react";
import { api, saveToken } from "../api";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth";

export default function RegisterPro() {
  const toast = useToast();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    company_name: "",
    siret: "",
    email: "",
    phone: "",
    delivery_address: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.register(form);
      if (res.access_token) saveToken(res.access_token);
      await refresh();
      toast.show(
        res.access_token
          ? "Compte créé — bienvenue !"
          : "Demande enregistrée — validation par Leray-Pointel",
        "success",
      );
      nav(res.access_token ? "/" : "/login", { replace: true });
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8">
      <Link
        to="/login"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700"
      >
        <ChevronLeft size={16} /> Retour
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-white">
            <Store size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Inscription professionnelle</h1>
            <p className="text-sm text-slate-500">
              Votre compte sera validé par Leray-Pointel sous 24h ouvrées.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Raison sociale" value={form.company_name} onChange={(v) => set("company_name", v)} required />
          <Field label="SIRET (14 chiffres)" value={form.siret} onChange={(v) => set("siret", v)} required />
          <Field label="Email professionnel" type="email" value={form.email} onChange={(v) => set("email", v)} required />
          <Field label="Téléphone" value={form.phone} onChange={(v) => set("phone", v)} required />
          <Field
            label="Adresse de livraison"
            value={form.delivery_address}
            onChange={(v) => set("delivery_address", v)}
            className="sm:col-span-2"
            required
          />
          <Field
            label="Mot de passe"
            type="password"
            value={form.password}
            onChange={(v) => set("password", v)}
            required
            className="sm:col-span-2"
          />

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {busy && <Loader2 className="animate-spin" size={16} />}
              Créer mon compte Pro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
      />
    </label>
  );
}
