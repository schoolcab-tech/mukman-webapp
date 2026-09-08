import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

const CW = 176;
const GAP = 28;
const PITCH = CW + GAP;

function PersonCard({ node, virtual, testidPrefix = "org-node" }) {
  const isOpen = virtual && node.kind === "open";
  const isHat = virtual && node.kind === "hat";
  return (
    <div
      data-testid={`${testidPrefix}-${node.id}`}
      className={`w-44 rounded-2xl px-4 py-4 text-center shadow-sm transition-all hover:shadow-md ${
        isOpen
          ? "bg-amber-50 border border-dashed border-amber-400"
          : isHat
            ? "bg-teal-50 border border-teal-300"
            : "bg-white border border-slate-200 hover:border-cyan-400/50"
      }`}
    >
      <div className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm font-bold font-display ${
        isOpen ? "bg-amber-200 text-amber-800" : isHat ? "bg-teal-600 text-white" : "bg-slate-900 text-cyan-400"
      }`}>
        {node.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
      </div>
      <div className="font-semibold text-slate-900 mt-2 leading-tight">{node.name}</div>
      <div className="text-xs text-slate-500 mt-0.5 leading-snug">{node.title}</div>
      {isOpen && (
        <span className="inline-block mt-2 text-[10px] font-semibold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
          Hiring soon
        </span>
      )}
      {node.department && !virtual && (
        <span className="inline-block mt-2 text-[10px] font-semibold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          {node.department}
        </span>
      )}
    </div>
  );
}

export default function OrgChart() {
  const [data, setData] = useState({ people: [], virtual: [] });

  useEffect(() => {
    api.get("/org-chart").then((r) => setData(r.data)).catch(() => {});
  }, []);

  const chart = useMemo(() => {
    const { people, virtual } = data;
    if (!people.length) return null;
    const founder = people.find((p) => !p.reports_to) || people[0];
    const kidsOf = (id) => people.filter((p) => p.reports_to === id);
    const direct = kidsOf(founder.id);
    const middle = direct.find((p) => kidsOf(p.id).length > 0) || null;
    const middleKids = middle ? kidsOf(middle.id) : [];
    const vFounder = virtual.filter((v) => v.reports_to === founder.id);
    const vMiddle = middle ? virtual.filter((v) => v.reports_to === middle.id) : [];
    const others = direct.filter((p) => !middle || p.id !== middle.id);
    const cols = [
      ...others.slice(0, 1).map((n) => ({ node: n, from: "founder", virtual: false })),
      ...vMiddle.map((n) => ({ node: n, from: "middle", virtual: true })),
      ...middleKids.map((n) => ({ node: n, from: "middle", virtual: false })),
      ...others.slice(1).map((n) => ({ node: n, from: "founder", virtual: false })),
      ...vFounder.map((n) => ({ node: n, from: "founder", virtual: true })),
    ];
    const width = cols.length * PITCH - GAP;
    const cx = (i) => i * PITCH + CW / 2;
    const colIdx = {};
    cols.forEach((c, i) => { if (!c.virtual) colIdx[c.node.id] = i; });
    const row2Ids = new Set(cols.filter((c) => !c.virtual).map((c) => c.node.id));
    const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
    const row3 = people
      .filter((p) => p.reports_to && row2Ids.has(p.reports_to))
      .map((p) => {
        const anchors = [colIdx[p.reports_to], ...(p.also_reports_to || []).map((a) => colIdx[a])]
          .filter((x) => x !== undefined)
          .sort((a, b) => a - b);
        const names = [p.reports_to, ...(p.also_reports_to || [])]
          .map((id) => peopleById[id]?.name)
          .filter(Boolean);
        return { node: p, anchors, names };
      });
    return { founder, middle, cols, width, cx, row3 };
  }, [data]);

  if (!chart) return <div className="text-sm text-slate-500" data-testid="org-loading">Loading org chart…</div>;

  const { founder, middle, cols, width, cx, row3 } = chart;
  const founderCols = cols.map((c, i) => (c.from === "founder" ? i : -1)).filter((i) => i >= 0);
  const middleCols = cols.map((c, i) => (c.from === "middle" ? i : -1)).filter((i) => i >= 0);

  return (
    <div className="space-y-6" data-testid="org-chart-page">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">MUKMAN TECHNOLOGIES</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">Organization Chart</h1>
        <p className="text-sm text-slate-500 mt-2">17-vehicle fleet · effective from current review. Managed by admin — grows as we grow.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 overflow-x-auto" data-testid="org-chart-canvas">
        <div className="mx-auto" style={{ width }}>
          {/* Founder */}
          <div className="flex justify-center">
            <div className="rounded-2xl border border-slate-300 bg-slate-50 px-6 py-4 text-center shadow-sm" data-testid={`org-node-${founder.id}`}>
              <div className="font-display font-bold text-slate-900 text-lg leading-tight">{founder.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{founder.title}</div>
            </div>
          </div>

          {/* Connector zone: founder bus + middle manager + middle bus */}
          <div className="relative">
            <div className="h-10" />
            {middle && (
              <div className="flex justify-center relative z-10">
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-8 py-4 text-center shadow-sm" data-testid={`org-node-${middle.id}`}>
                  <div className="font-display font-bold text-slate-900 text-base leading-tight">{middle.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{middle.title}</div>
                </div>
              </div>
            )}
            <div className="h-10" />

            {/* founder vertical into bus */}
            <div className="absolute w-px bg-slate-300" style={{ left: width / 2, top: 0, height: 20 }} />
            {/* founder bus */}
            {founderCols.length > 0 && (
              <div className="absolute h-px bg-slate-300" style={{ top: 20, left: cx(founderCols[0]), width: cx(founderCols[founderCols.length - 1]) - cx(founderCols[0]) }} />
            )}
            {/* founder extended drops to his direct reportees (span past the middle row) */}
            {founderCols.map((i) => (
              <div key={`fd-${i}`} className="absolute w-px bg-slate-400" style={{ left: cx(i), top: 20, bottom: 0 }} />
            ))}
            {/* founder bus -> middle card */}
            {middle && <div className="absolute w-px bg-slate-300" style={{ left: width / 2, top: 20, height: 20 }} />}
            {/* middle vertical into his bus */}
            {middle && middleCols.length > 0 && (
              <div className="absolute w-px bg-slate-300" style={{ left: width / 2, bottom: 0, height: 20 }} />
            )}
            {/* middle bus */}
            {middleCols.length > 0 && (
              <div className="absolute h-px bg-slate-300" style={{ bottom: 20, left: cx(middleCols[0]), width: cx(middleCols[middleCols.length - 1]) - cx(middleCols[0]) }} />
            )}
            {/* middle drops */}
            {middleCols.map((i) => (
              <div key={`md-${i}`} className="absolute w-px bg-slate-300" style={{ left: cx(i), bottom: 0, height: 20 }} />
            ))}
          </div>

          {/* Peer row — everyone on the same line */}
          <div className="flex" style={{ gap: GAP }} data-testid="org-peer-row">
            {cols.map((c) => (
              <div key={c.node.id} className="flex flex-col items-center">
                <div className={`w-px h-4 ${c.from === "founder" ? "bg-slate-400" : "bg-slate-300"}`} />
                <PersonCard node={c.node} virtual={c.virtual} />
              </div>
            ))}
          </div>

          {/* Shared-report row (e.g. Ashish under two managers) */}
          {row3.length > 0 && (
            <div className="relative mt-0" style={{ width, height: 250 }}>
              {row3.map(({ node, anchors, names }) => {
                const xs = anchors.map((i) => cx(i));
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const mid = (minX + maxX) / 2;
                const cardW = 230;
                return (
                  <div key={node.id} className="absolute top-0" style={{ left: mid - cardW / 2, width: cardW }}>
                    <div className="relative h-8">
                      {xs.map((x) => (
                        <div key={x} className="absolute top-0 h-5 border-l border-dashed border-slate-400" style={{ left: x - (mid - cardW / 2) }} />
                      ))}
                      {maxX > minX && (
                        <div className="absolute top-5 border-t border-dashed border-slate-400" style={{ left: minX - (mid - cardW / 2), width: maxX - minX }} />
                      )}
                      <div className="absolute left-1/2 top-5 h-3 border-l border-dashed border-slate-400" />
                    </div>
                    <div className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-4 text-center shadow-sm" data-testid={`org-node-${node.id}`}>
                      <div className="font-display font-bold text-slate-900 leading-tight">{node.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 leading-snug">{node.title}</div>
                      {names.length > 1 && (
                        <div className="text-[10px] text-slate-400 mt-1.5">Reports to {names.join(" & ")}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400 mt-8 text-center">
          Shared report: Ashish also reports to Abhimanyu for weekly rollups · Maker-checker: Himanshu's fleet sheet reviewed by Abhimanyu
        </p>
      </div>
    </div>
  );
}
