import { useEffect, useState } from "react";
import { api, Product } from "../../api";
import { Link } from "react-router-dom";
import { useToast } from "../../components/Toast";
import { Edit2, Plus, Trash2, Loader2, Eye, EyeOff } from "lucide-react";

export default function AdminProducts() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      setItems(await api.adminProducts());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleActive(p: Product) {
    try {
      const u = await api.adminSetProductActive(p.id, !p.is_active);
      setItems((prev) => prev.map((x) => (x.id === p.id ? u : x)));
      toast.show(u.is_active ? "Produit visible" : "Produit masqué", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  async function del(p: Product) {
    if (!confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
    try {
      await api.adminDeleteProduct(p.id);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      toast.show("Supprimé", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  const filtered = search.trim()
    ? items.filter((p) =>
        (p.name + " " + p.category + " " + (p.subcategory || "")).toLowerCase().includes(
          search.toLowerCase().trim(),
        ),
      )
    : items;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Catalogue</h1>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <Plus size={14} /> Nouveau produit
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher…"
        className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
      />

      {loading ? (
        <div className="grid min-h-[200px] place-items-center">
          <Loader2 className="animate-spin text-brand-700" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft"
            >
              <img src={p.image_url} alt={p.name} className="aspect-[4/3] w-full object-cover" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.category} • {p.unit}
                    </div>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " +
                      (p.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700")
                    }
                  >
                    {p.is_active ? "Visible" : "Masqué"}
                  </span>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <button
                    onClick={() => toggleActive(p)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {p.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                    {p.is_active ? "Masquer" : "Afficher"}
                  </button>
                  <Link
                    to={`/admin/products/${p.id}/edit`}
                    className="inline-flex items-center justify-center gap-1 rounded-md bg-brand-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
                  >
                    <Edit2 size={12} /> Modifier
                  </Link>
                  <button
                    onClick={() => del(p)}
                    className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
