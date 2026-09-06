import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

function OrgCard({ node, kidsCount }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 text-center min-w-44 shadow-sm hover:shadow-md hover:border-cyan-400/50 transition-all" data-testid={`org-node-${node.id}`}>
      <div className="h-10 w-10 mx-auto rounded-full bg-slate-900 text-cyan-400 flex items-center justify-center text-sm font-bold font-display">
        {node.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
      </div>
      <div className="font-semibold text-slate-900 mt-2">{node.name}</div>
      <div className="text-xs text-slate-500 mt-0.5">{node.title}</div>
      {node.department && (
        <span className="inline-block mt-2 text-[10px] font-semibold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          {node.department}
        </span>
      )}
      {kidsCount > 0 && <div className="text-[10px] text-cyan-600 font-semibold mt-1.5">{kidsCount} reportee{kidsCount > 1 ? "s" : ""}</div>}
    </div>
  );
}

function renderTree(node, childrenMap) {
  const kids = childrenMap[node.id] || [];
  return (
    <div key={node.id} className="flex flex-col items-center">
      <OrgCard node={node} kidsCount={kids.length} />
      {kids.length > 0 && (
        <>
          <div className="w-px h-6 bg-slate-300" />
          <div className="flex gap-6 items-start relative">
            {kids.length > 1 && <div className="absolute top-0 left-10 right-10 h-px bg-slate-300" />}
            {kids.map((k) => (
              <div key={k.id} className="flex flex-col items-center">
                <div className="w-px h-6 bg-slate-300" />
                {renderTree(k, childrenMap)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrgChart() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.get("/org-chart").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  const { roots, childrenMap, departments } = useMemo(() => {
    const visible = filter ? users.filter((u) => u.department === filter) : users;
    const visibleIds = new Set(visible.map((u) => u.id));
    const cmap = {};
    visible.forEach((u) => {
      if (u.reports_to && visibleIds.has(u.reports_to)) {
        cmap[u.reports_to] = cmap[u.reports_to] || [];
        cmap[u.reports_to].push(u);
      }
    });
    const rts = visible.filter((u) => !u.reports_to || !visibleIds.has(u.reports_to));
    const depts = [...new Set(users.map((u) => u.department).filter(Boolean))];
    return { roots: rts, childrenMap: cmap, departments: depts };
  }, [users, filter]);

  return (
    <div className="space-y-6" data-testid="org-chart-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">WORK & COMPLIANCE</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">Org Chart & Hierarchy</h1>
          <p className="text-sm text-slate-500 mt-2">Reporting lines across Mukman Group. Managed by admin — grows as we grow.</p>
        </div>
        <div className="flex gap-2 flex-wrap" data-testid="org-department-filters">
          <button onClick={() => setFilter("")} data-testid="org-filter-all"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${!filter ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
            All
          </button>
          {departments.map((d) => (
            <button key={d} onClick={() => setFilter(d)} data-testid={`org-filter-${d.toLowerCase().replace(/\s+/g, "-")}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === d ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 overflow-x-auto">
        <div className="flex gap-10 justify-center min-w-max py-4">
          {roots.map((r) => renderTree(r, childrenMap))}
        </div>
        {roots.length === 0 && <p className="text-sm text-slate-500 text-center py-8" data-testid="org-empty">No employees in this view.</p>}
      </div>
    </div>
  );
}
