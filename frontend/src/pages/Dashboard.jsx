import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bus, Briefcase, Landmark, ArrowUpRight } from "lucide-react";

const BRANDS = [
  {
    key: "brand_schoolcab",
    name: "SchoolCab",
    tag: "School Commute Mobility",
    icon: Bus,
    badge: "bg-amber-100 text-amber-900 border border-amber-300/40",
    border: "border-amber-400/40 hover:border-amber-500",
    img: "https://images.unsplash.com/photo-1786684409967-d0368efc57e2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxzY2hvb2wlMjBidXMlMjB5ZWxsb3clMjBtb2JpbGl0eSUyMHRyYW5zcG9ydGF0aW9ufGVufDB8fHx8MTc4ODcxNDgwMnww&ixlib=rb-4.1.0&q=85",
  },
  {
    key: "brand_cabzee",
    name: "Cabzee",
    tag: "Fixed-Route Office Commute",
    icon: Briefcase,
    badge: "bg-sky-100 text-sky-900 border border-sky-300/40",
    border: "border-sky-400/40 hover:border-sky-500",
    img: "https://images.unsplash.com/photo-1780296269675-169390638617?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwxfHxleGVjdXRpdmUlMjBjYXIlMjBidXNpbmVzcyUyMHRyYXZlbHxlbnwwfHx8fDE3ODg3MTQ4MDJ8MA&ixlib=rb-4.1.0&q=85",
  },
  {
    key: "brand_advisory",
    name: "Mukman Advisory",
    tag: "Financial Services",
    icon: Landmark,
    badge: "bg-teal-100 text-teal-900 border border-teal-300/40",
    border: "border-teal-400/40 hover:border-teal-500",
    img: "https://images.unsplash.com/photo-1556761175-b413da4baf72?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHw0fHxjb3Jwb3JhdGUlMjB0ZWFtJTIwd29ya2luZyUyMG9mZmljZXxlbnwwfHx8fDE3ODg3MTQ4MDJ8MA&ixlib=rb-4.1.0&q=85",
  },
];

export default function Dashboard() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    api.get("/content").then((r) => setContent(r.data)).catch(() => setContent({}));
  }, []);

  const vision = content?.vision;
  const stats = content?.achievements?.stats || [];

  return (
    <div className="space-y-10" data-testid="dashboard-page">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-8 sm:p-12">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-cyan-400 via-amber-400 to-teal-400" />
        <div className="text-xs font-semibold tracking-[0.2em] text-cyan-400 mb-4" data-testid="dashboard-eyebrow">MUKMAN TECHNOLOGIES · HOLDING GROUP</div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl leading-tight" data-testid="dashboard-vision-title">
          {vision?.title || "The Mukman Vision"}
        </h1>
        <div className="mt-6 max-w-3xl text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-line" data-testid="dashboard-vision-body">
          {vision?.body || "Loading…"}
        </div>
        <div className="mt-8 flex flex-wrap gap-3 text-xs">
          {["SchoolCab", "Cabzee", "Mukman Advisory"].map((b) => (
            <span key={b} className="px-3 py-1.5 rounded-full bg-slate-800 text-cyan-300 border border-cyan-500/30">{b}</span>
          ))}
        </div>
      </section>

      {stats.length > 0 && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-400">{s.label}</div>
              <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">THE GROUP</div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mt-1">Companies under Mukman</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BRANDS.map((b) => (
            <div key={b.key} data-testid={`brand-card-${b.key}`} className={`group bg-white rounded-2xl border ${b.border} overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}>
              <div className="h-40 overflow-hidden">
                <img src={b.img} alt={b.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full ${b.badge}`}>{b.tag}</span>
                  <b.icon className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="font-display text-xl font-semibold text-slate-900 mt-3">{b.name}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mt-2 line-clamp-4">{content?.[b.key]?.body || ""}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6" data-testid="dashboard-people-strip">
        <div className="flex-1">
          <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">OUR PEOPLE</div>
          <h3 className="font-display text-2xl font-semibold text-slate-900 mt-2">The best of the best, fixing mobility together.</h3>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-2xl">
            Mukman Group is a team of exceptional professionals across operations, fleet, tech, marketing and finance — all working with one combined aim: fixing the mobility world for everyone who rides on a recurring basis.
          </p>
        </div>
        <a href="/org-chart" data-testid="dashboard-orgchart-link" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors">
          View Org Chart <ArrowUpRight className="h-4 w-4" />
        </a>
      </section>
    </div>
  );
}
