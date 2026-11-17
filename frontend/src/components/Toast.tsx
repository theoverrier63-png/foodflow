import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import clsx from "clsx";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; msg: string };
type Ctx = { show: (msg: string, kind?: Kind) => void };

const ToastCtx = createContext<Ctx | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((msg: string, kind: Kind = "info") => {
    const id = ++seq;
    setItems((prev) => [...prev, { id, kind, msg }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex w-96 max-w-[90vw] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 shadow-popup backdrop-blur",
              t.kind === "success" && "bg-emerald-600 text-white",
              t.kind === "error" && "bg-rose-600 text-white",
              t.kind === "info" && "bg-slate-800 text-white",
            )}
          >
            {t.kind === "success" && <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
            {t.kind === "error" && <AlertCircle size={18} className="mt-0.5 shrink-0" />}
            {t.kind === "info" && <Info size={18} className="mt-0.5 shrink-0" />}
            <div className="flex-1 text-sm">{t.msg}</div>
            <button
              onClick={() =>
                setItems((prev) => prev.filter((i) => i.id !== t.id))
              }
              className="rounded-md opacity-70 hover:opacity-100"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
