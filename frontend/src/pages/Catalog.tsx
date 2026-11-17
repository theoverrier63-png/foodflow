import { useEffect, useMemo, useState } from "react";
import { api, Product } from "../api";
import ProductCard from "../components/ProductCard";
import { Search, X, Loader2, Clock } from "lucide-react";
import { useAuth } from "../auth";
import { Link } from "react-router-dom";

export default function Catalog() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [habits, setHabits] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["Tous"]);
  const [category, setCategory] = useState<string>("Tous");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [prods, cats] = await Promise.all([api.products(), api.categories()]);
        setProducts(prods);
        const raw = cats.categories || [];
        setCategories(raw.includes("Tous") ? raw : ["Tous", ...raw]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (user?.account_type === "business" && user.status === "approved") {
      api.orderHabits(10).then(setHabits).catch(() => setHabits([]));
    } else {
      setHabits([]);
    }
  }, [user]);

  const filtered = useMemo(() => {
    let r = products;
    if (category !== "Tous") r = r.filter((p) => p.category === category);
    if (search.trim())
      r = r.filter((p) =>
        (p.name + " " + p.origin + " " + (p.subcategory || "")).toLowerCase().includes(
          search.toLowerCase().trim(),
        ),
      );
    return r;
  }, [products, category, search]);

  const pending = user?.account_type === "business" && user.status !== "approved";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Catalogue</h1>
          <p className="text-sm text-slate-500">
            Fruits, légumes et herbes frais — commandez sans vous déplacer.
          </p>
        </div>
        <div className="relative lg:max-w-md lg:flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit, une origine…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label="Effacer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {pending && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Votre compte Pro est en attente de validation par Leray-Pointel. Vous pourrez
          commander dès approbation.
        </div>
      )}

      {/* Categories chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-semibold transition " +
              (category === c
                ? "bg-brand-700 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100")
            }
          >
            {c}
          </button>
        ))}
      </div>

      {/* Habits */}
      {habits.length > 0 && !search && category === "Tous" && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Clock size={16} className="text-brand-700" />
            <h2 className="text-lg font-bold text-slate-900">Vos habitudes de commande</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {habits.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid min-h-[200px] place-items-center">
          <Loader2 className="animate-spin text-brand-700" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Aucun produit ne correspond à votre recherche.
          <div className="mt-3">
            <Link to="/our-story" className="text-brand-700 underline">
              Découvrez notre histoire en attendant →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
