import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, Store, Loader2 } from "lucide-react";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { api } from "../api";

export default function Login() {
  const { login, user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    api.getLoginCover().then((r) => setCover(r.image_url)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "admin") nav("/admin", { replace: true });
      else nav(loc.state?.from || "/", { replace: true });
    }
  }, [user, loading, nav, loc.state]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return toast.show("Renseignez tous les champs", "error");
    setBusy(true);
    try {
      await login(email, password);
      toast.show("Connexion réussie", "success");
    } catch (e: any) {
      toast.show(e?.message || "Identifiants invalides", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Visual */}
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={
            cover ||
            "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80"
          }
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-800/80 via-brand-700/60 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-end p-14 text-white">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Store size={14} />
            Fruits & légumes frais — en gros
          </div>
          <h1 className="text-4xl font-bold leading-tight">
            Leray-Pointel
            <br />
            au service de vos cuisines.
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/80">
            Commandez en quelques clics votre marché du jour — professionnels et
            particuliers, livré sous 24h.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-soft">
          <div className="mb-6 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-white">
              <Store size={20} />
            </span>
            <div>
              <div className="text-sm font-semibold text-brand-700">LERAY-POINTEL</div>
              <div className="text-xs text-slate-500">Portail client</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Connexion</h2>
          <p className="mt-1 text-sm text-slate-500">
            Accédez à votre catalogue et passez commande en ligne.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
                placeholder="contact@entreprise.fr"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Mot de passe
              </span>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
                  placeholder="•••••••"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Masquer" : "Afficher"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-1 text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
              Se connecter
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            <span>Pas encore de compte ?</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/register/pro"
              className="rounded-md border border-brand-700 py-2.5 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              Je suis Pro
            </Link>
            <Link
              to="/register/particulier"
              className="rounded-md border border-slate-300 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Je suis Particulier
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
