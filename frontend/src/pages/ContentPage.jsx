import { useEffect, useState } from "react";
import api from "@/lib/api";
import { CalendarClock } from "lucide-react";

export default function ContentPage({ pageKey, eyebrow, badgeClass, testid }) {
  const [doc, setDoc] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.get("/content").then((r) => {
      if (r.data?.[pageKey]) setDoc(r.data[pageKey]);
      else setMissing(true);
    }).catch(() => setMissing(true));
  }, [pageKey]);

  return (
    <div className="space-y-8" data-testid={testid}>
      <div>
        <span className={`text-xs font-semibold tracking-[0.15em] uppercase px-2.5 py-1 rounded-full ${badgeClass}`} data-testid={`${pageKey}-eyebrow`}>{eyebrow}</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mt-4" data-testid={`${pageKey}-title`}>
          {doc?.title || (missing ? "Content not published yet" : "Loading…")}
        </h1>
      </div>

      {doc?.stats?.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid={`${pageKey}-stats`}>
          {doc.stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-400">{s.label}</div>
              <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10">
        <div className="max-w-3xl text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line prose-body" data-testid={`${pageKey}-body`}>
          {doc?.body || ""}
        </div>
        {doc?.updated_at && (
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
            <CalendarClock className="h-3.5 w-3.5" />
            Last updated {new Date(doc.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} by Mukman Admin
          </div>
        )}
      </div>
    </div>
  );
}
