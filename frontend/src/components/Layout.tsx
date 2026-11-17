import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Menu,
  User as UserIcon,
  LogOut,
  BookOpen,
  Store,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import clsx from "clsx";

export default function Layout({ openCart }: { openCart: () => void }) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    nav("/login", { replace: true });
  }

  const navItems: { to: string; label: string; icon: any }[] = [
    { to: "/", label: "Catalogue", icon: Store },
    { to: "/orders", label: "Historique", icon: Package },
    { to: "/our-story", label: "Notre histoire", icon: BookOpen },
    { to: "/profile", label: "Compte", icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-brand-700 font-bold tracking-tight"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">
              <Store size={18} />
            </span>
            <span className="hidden text-lg sm:block">LERAY-POINTEL</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  clsx(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )
                }
              >
                <n.icon size={15} />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="hidden rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:inline-flex"
              >
                Espace admin
              </Link>
            )}
            <button
              onClick={openCart}
              className="relative inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              <ShoppingCart size={16} />
              <span className="hidden sm:inline">Panier</span>
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-amber-400 px-1 text-xs font-bold text-slate-900">
                  {count}
                </span>
              )}
            </button>
            <button
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {menuOpen && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col px-4 py-2">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      "inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium",
                      isActive ? "bg-brand-50 text-brand-700" : "text-slate-700",
                    )
                  }
                >
                  <n.icon size={15} />
                  {n.label}
                </NavLink>
              ))}
              {user?.role === "admin" && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-brand-700"
                >
                  <Store size={15} /> Espace admin
                </Link>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-rose-600"
              >
                <LogOut size={15} /> Déconnexion
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-10">
        <Outlet />
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Leray-Pointel — Fruits & légumes frais
      </footer>
    </div>
  );
}
