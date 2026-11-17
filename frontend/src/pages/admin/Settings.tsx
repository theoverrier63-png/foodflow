import { useEffect, useState } from "react";
import { api } from "../../api";
import { useToast } from "../../components/Toast";
import { Loader2, Upload, Trash2 } from "lucide-react";

export default function Settings() {
  const toast = useToast();
  const [season, setSeason] = useState<"summer" | "winter" | "all">("all");
  const [cover, setCover] = useState<string | null>(null);
  const [story, setStory] = useState({ title: "", body: "", images: ["", "", "", ""] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, c, st] = await Promise.all([
          api.getSeason(),
          api.getLoginCover(),
          api.getOurStory(),
        ]);
        setSeason(s.season);
        setCover(c.image_url);
        const imgs = [...(st.images || [])];
        while (imgs.length < 4) imgs.push("");
        setStory({ title: st.title || "", body: st.body || "", images: imgs });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveSeason(v: "summer" | "winter" | "all") {
    try {
      await api.setSeason(v);
      setSeason(v);
      toast.show("Saison mise à jour", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  async function saveCover() {
    if (!cover) return;
    try {
      await api.setLoginCover(cover);
      toast.show("Image de connexion enregistrée", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  async function removeCover() {
    try {
      await api.deleteLoginCover();
      setCover(null);
      toast.show("Image supprimée", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  async function saveStory() {
    setSaving(true);
    try {
      await api.setOurStory(story.title, story.body, story.images.filter((i) => i.trim()));
      toast.show("Page « Notre histoire » enregistrée", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="grid min-h-[200px] place-items-center">
        <Loader2 className="animate-spin text-brand-700" />
      </div>
    );

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">Paramètres</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-bold text-slate-900">Saison en cours</h2>
        <p className="mt-1 text-sm text-slate-500">
          Les produits hors saison seront masqués automatiquement du catalogue client.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            { k: "all", l: "Toute l'année" },
            { k: "summer", l: "Été" },
            { k: "winter", l: "Hiver" },
          ] as const).map((s) => (
            <button
              key={s.k}
              onClick={() => saveSeason(s.k)}
              className={
                "rounded-full px-4 py-2 text-sm font-semibold " +
                (season === s.k
                  ? "bg-brand-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200")
              }
            >
              {s.l}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-bold text-slate-900">Image de la page de connexion</h2>
        <p className="mt-1 text-sm text-slate-500">
          Affichée à gauche de l&apos;écran de connexion sur desktop.
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">URL de l&apos;image</span>
          <input
            type="url"
            value={cover || ""}
            onChange={(e) => setCover(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
          />
        </label>
        {cover && (
          <img src={cover} alt="" className="mt-3 h-32 w-56 rounded-md object-cover" />
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={saveCover}
            className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <Upload size={14} /> Enregistrer
          </button>
          {cover && (
            <button
              onClick={removeCover}
              className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={14} /> Supprimer
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-bold text-slate-900">Page « Notre histoire »</h2>
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Titre</span>
            <input
              value={story.title}
              onChange={(e) => setStory((p) => ({ ...p, title: e.target.value }))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Texte</span>
            <textarea
              value={story.body}
              onChange={(e) => setStory((p) => ({ ...p, body: e.target.value }))}
              rows={6}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Images (jusqu&apos;à 4 URLs)</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {story.images.map((img, i) => (
                <input
                  key={i}
                  value={img}
                  onChange={(e) =>
                    setStory((p) => {
                      const next = [...p.images];
                      next[i] = e.target.value;
                      return { ...p, images: next };
                    })
                  }
                  placeholder={`URL image ${i + 1}`}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700"
                />
              ))}
            </div>
          </div>
          <button
            onClick={saveStory}
            disabled={saving}
            className="inline-flex max-w-max items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="animate-spin" size={14} />}
            Enregistrer
          </button>
        </div>
      </section>
    </div>
  );
}
