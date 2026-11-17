import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useToast } from "../../components/Toast";
import { ChevronLeft, Loader2, Package, Box, Archive } from "lucide-react";

type Form = {
  name: string;
  category: string;
  subcategory: string;
  origin: string;
  unit: string;
  image_url: string;
  description: string;
  season: "summer" | "winter" | "all";
  sell_by_kg: boolean;
  sell_by_piece: boolean;
};

const EMPTY: Form = {
  name: "",
  category: "Fruits",
  subcategory: "",
  origin: "France",
  unit: "",
  image_url: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600",
  description: "",
  season: "all",
  sell_by_kg: false,
  sell_by_piece: true,
};

const CATEGORIES = ["Fruits", "Légumes", "Herbes"];

export default function ProductEdit() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState<Form>(EMPTY);
  const [cagetteMode, setCagetteMode] = useState<"none" | "pieces" | "kg">("none");
  const [cagetteContent, setCagetteContent] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const list = await api.adminProducts();
        const p = list.find((x) => x.id === id);
        if (!p) return;
        setForm({
          name: p.name,
          category: p.category,
          subcategory: p.subcategory || "",
          origin: p.origin,
          unit: p.unit,
          image_url: p.image_url,
          description: p.description,
          season: (p.season as any) || "all",
          sell_by_kg: p.sell_by_kg ?? p.sell_unit === "kg",
          sell_by_piece: p.sell_by_piece ?? p.sell_unit !== "kg",
        });
        if (p.cagette_content_pieces) {
          setCagetteMode("pieces");
          setCagetteContent(String(p.cagette_content_pieces));
        } else if (p.cagette_content_kg) {
          setCagetteMode("kg");
          setCagetteContent(String(p.cagette_content_kg));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, id]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.show("Nom requis", "error");
    if (!form.unit.trim()) return toast.show("Format requis", "error");
    if (!form.sell_by_kg && !form.sell_by_piece && cagetteMode === "none")
      return toast.show("Sélectionnez au moins une unité de vente", "error");

    let cagette_content_pieces: number | undefined;
    let cagette_content_kg: number | undefined;
    if (cagetteMode === "pieces") {
      const n = parseInt(cagetteContent, 10);
      if (!n || n <= 0) return toast.show("Nombre de pièces invalide", "error");
      cagette_content_pieces = n;
    } else if (cagetteMode === "kg") {
      const n = parseFloat(cagetteContent.replace(",", "."));
      if (!n || n <= 0) return toast.show("Poids invalide", "error");
      cagette_content_kg = n;
    }

    const payload = {
      ...form,
      subcategory: form.subcategory.trim() || undefined,
      cagette_content_pieces,
      cagette_content_kg,
    };
    setSaving(true);
    try {
      if (editing && id) {
        await api.adminUpdateProduct(id, payload as any);
      } else {
        await api.adminCreateProduct(payload as any);
      }
      toast.show("Enregistré", "success");
      nav("/admin/products");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="grid min-h-[300px] place-items-center">
        <Loader2 className="animate-spin text-brand-700" />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/admin/products" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ChevronLeft size={16} /> Retour
      </Link>

      <h1 className="text-3xl font-bold text-slate-900">
        {editing ? "Modifier le produit" : "Nouveau produit"}
      </h1>

      <form onSubmit={submit} className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" value={form.name} onChange={(v) => set("name", v)} required />
          <Field label="Format (ex: Cagette 5kg)" value={form.unit} onChange={(v) => set("unit", v)} required />
          <Field label="Origine" value={form.origin} onChange={(v) => set("origin", v)} required />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Catégorie</label>
            <div className="flex gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("category", c)}
                  className={
                    "rounded-full px-3 py-1.5 text-xs font-semibold " +
                    (form.category === c
                      ? "bg-brand-700 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="Sous-catégorie (optionnel)"
            value={form.subcategory}
            onChange={(v) => set("subcategory", v)}
            className="sm:col-span-2"
          />
        </div>

        <div className="grid gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Unités de vente</label>
            <div className="mt-1 text-xs text-slate-500">
              Aucun prix n&apos;est demandé. Cochez simplement comment vos clients peuvent commander.
            </div>
          </div>
          <Toggle
            icon={<Package size={16} />}
            label="Vendu au kilo"
            checked={form.sell_by_kg}
            onChange={(v) => set("sell_by_kg", v)}
          />
          <Toggle
            icon={<Box size={16} />}
            label="Vendu à la pièce"
            checked={form.sell_by_piece}
            onChange={(v) => set("sell_by_piece", v)}
          />
        </div>

        <div className="grid gap-3">
          <label className="text-xs font-semibold text-slate-600">Cagette (optionnel)</label>
          <div className="flex flex-wrap gap-2">
            {(["none", "pieces", "kg"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCagetteMode(m)}
                className={
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold " +
                  (cagetteMode === m
                    ? "bg-brand-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200")
                }
              >
                <Archive size={12} /> {m === "none" ? "Aucune" : m === "pieces" ? "En pièces" : "En kg"}
              </button>
            ))}
          </div>
          {cagetteMode !== "none" && (
            <input
              value={cagetteContent}
              onChange={(e) => setCagetteContent(e.target.value)}
              inputMode={cagetteMode === "kg" ? "decimal" : "numeric"}
              placeholder={cagetteMode === "pieces" ? "Ex: 24" : "Ex: 5"}
              className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
            />
          )}
        </div>

        <div className="grid gap-3">
          <label className="text-xs font-semibold text-slate-600">Saison</label>
          <div className="flex gap-2">
            {([
              { k: "all", l: "Toute l'année" },
              { k: "summer", l: "Été" },
              { k: "winter", l: "Hiver" },
            ] as const).map((s) => (
              <button
                key={s.k}
                type="button"
                onClick={() => set("season", s.k)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-semibold " +
                  (form.season === s.k
                    ? "bg-brand-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200")
                }
              >
                {s.l}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="URL de l'image"
          value={form.image_url}
          onChange={(v) => set("image_url", v)}
          required
        />
        {form.image_url && (
          <img
            src={form.image_url}
            alt=""
            className="h-40 w-full max-w-xs rounded-lg object-cover"
          />
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Link
            to="/admin/products"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="animate-spin" size={14} />}
            {editing ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
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
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
      />
    </label>
  );
}

function Toggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        {icon} {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 cursor-pointer accent-brand-700"
      />
    </label>
  );
}
