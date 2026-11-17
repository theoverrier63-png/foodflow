import { useEffect, useState } from "react";
import { api } from "../api";
import { Loader2 } from "lucide-react";

export default function OurStory() {
  const [data, setData] = useState<{ title: string; body: string; images: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOurStory().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="grid min-h-[300px] place-items-center">
        <Loader2 className="animate-spin text-brand-700" />
      </div>
    );
  if (!data) return null;

  return (
    <article className="prose max-w-none">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft lg:p-10">
        <h1 className="text-3xl font-bold text-slate-900">{data.title || "Notre histoire"}</h1>
        <p className="mt-4 whitespace-pre-wrap text-slate-700">
          {data.body || "Bientôt disponible."}
        </p>
        {data.images?.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {data.images.filter(Boolean).map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="aspect-[4/3] w-full rounded-xl object-cover"
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
