import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  UserPlus,
  Settings,
  LogOut,
  Store,
  ArrowLeftRight,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../auth";

const SIDEBAR_ITEMS = [
  { to: "/admin", end: true, label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Commandes", icon: ShoppingBag },
  { to: "/admin/products", label: "Catalogue", icon: Package },
  { to: "/admin/clients", label: "Clients Pro", icon: Users },
  { to: "/admin/pending", label: "Validations", icon: UserPlus },
  { to: "/admin/settings", label: "Paramètres", icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  function handleLogout() {
    logout();
    nav("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">
            <Store size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-brand-700">LERAY-POINTEL</div>
            <div className="text-xs text-slate-500">Admin</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {SIDEBAR_ITEMS.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                clsx(
                  "mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-700 text-white shadow-soft"
                    : "text-slate-600 hover:bg-slate-100",
                )
              }
            >
              <i.icon size={16} />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <Link
            to="/"
            className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeftRight size={16} /> Retour au site
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <Link to="/admin" className="font-bold text-brand-700">
            LERAY-POINTEL · Admin
          </Link>
        </header>

        {/* Mobile horizontal nav */}
        <nav className="scrollbar-hide flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          {SIDEBAR_ITEMS.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                clsx(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
                  isActive
                    ? "bg-brand-700 text-white"
                    : "bg-slate-100 text-slate-700",
                )
              }
            >
              <i.icon size={14} /> {i.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-4 py-6 lg:px-10 lg:py-8">
          {!user || user.role !== "admin" ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
              Accès réservé aux administrateurs.
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
