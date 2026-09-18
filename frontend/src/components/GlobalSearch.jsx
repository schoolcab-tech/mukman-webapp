import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import EmployeeHover, { slackDeepLink } from "@/components/EmployeeHover";
import { Search, Slack, ArrowLeft, ChevronRight } from "lucide-react";

const PROCESSES = [
  { name: "Timesheet & Calendar", to: "/timesheet", keys: "timesheet attendance hours task calendar time sheet" },
  { name: "Periodic Reviews", to: "/reviews", keys: "review weekly monthly quarterly annual appraisal performance" },
  { name: "Feedback & Grievances", to: "/feedback", keys: "feedback grievance suggestion complaint" },
  { name: "Employee Benefits", to: "/benefits", keys: "benefits insurance medical perks refreshment counselling" },
  { name: "Valuation & Market Cap", to: "/valuation", keys: "valuation market cap funding worth" },
  { name: "Milestones & Achievements", to: "/achievements", keys: "achievements milestones wins" },
  { name: "Org Chart", to: "/org-chart", keys: "org chart hierarchy reporting structure" },
  { name: "Notification Hub", to: "/notifications", keys: "notifications alerts whatsapp reminders" },
  { name: "Admin Console", to: "/admin", keys: "admin employees penalty broadcast settings", adminOnly: true },
];

export default function GlobalSearch({ open, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState({ people: [], slack_team_id: "" });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(null);
      api.get("/org-chart").then((r) => setDirectory(r.data)).catch(() => {});
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const processes = useMemo(() => {
    const list = PROCESSES.filter((p) => !p.adminOnly || user.role === "admin");
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.keys.includes(q));
  }, [q, user]);

  const employees = useMemo(() => {
    if (!q) return directory.people;
    return directory.people.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q) || (p.department || "").toLowerCase().includes(q)
    );
  }, [q, directory]);

  const go = (to) => { onClose(); navigate(to); };

  const chainUp = (emp) => {
    const chain = [];
    let cur = directory.people.find((p) => p.id === emp.reports_to);
    while (cur && chain.length < 4) {
      chain.unshift(cur);
      cur = directory.people.find((p) => p.id === cur.reports_to);
    }
    return chain;
  };

  const reporteesOf = (emp) => directory.people.filter((p) => p.reports_to === emp.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden" data-testid="global-search-dialog">
        {!selected ? (
          <div>
            <div className="flex items-center gap-3 px-4 border-b border-slate-100">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                autoFocus
                data-testid="global-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a process (timesheet, reviews…) or an employee…"
                className="flex-1 h-12 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {processes.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-400">Processes</div>
                  {processes.map((p) => (
                    <button key={p.to} onClick={() => go(p.to)} data-testid={`search-process-${p.to.replace(/\//g, "") || "home"}`}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 text-left transition-colors">
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
              {employees.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-400">Employees</div>
                  {employees.map((e) => (
                    <EmployeeHover key={e.id} employee={e} people={directory.people} teamId={directory.slack_team_id}>
                      <button onClick={() => setSelected(e)} data-testid={`search-employee-${e.id}`}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 text-left transition-colors">
                        <span className="h-8 w-8 rounded-full bg-slate-900 text-cyan-400 flex items-center justify-center text-[11px] font-bold font-display shrink-0">
                          {e.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-800 truncate">{e.name}</span>
                          <span className="block text-xs text-slate-400 truncate">{e.title}{e.department ? ` · ${e.department}` : ""}</span>
                        </span>
                      </button>
                    </EmployeeHover>
                  ))}
                </div>
              )}
              {processes.length === 0 && employees.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8" data-testid="search-no-results">No matches for “{query}”.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5" data-testid="search-employee-detail">
            <button onClick={() => setSelected(null)} data-testid="search-employee-back"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 mb-4 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to results
            </button>
            <div className="flex flex-col items-center text-center">
              {chainUp(selected).map((m) => (
                <div key={m.id} className="flex flex-col items-center">
                  <div className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200" data-testid={`search-chain-${m.id}`}>
                    <div className="text-sm font-semibold text-slate-800">{m.name}</div>
                    <div className="text-[11px] text-slate-500">{m.title}</div>
                  </div>
                  <div className="w-px h-4 bg-slate-300" />
                </div>
              ))}
              <div className="px-5 py-3 rounded-xl bg-slate-900 border border-cyan-500/40" data-testid={`search-detail-card-${selected.id}`}>
                <div className="font-display font-bold text-white">{selected.name}</div>
                <div className="text-xs text-cyan-300">{selected.title}</div>
                {selected.department && <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">{selected.department}</div>}
              </div>
              {reporteesOf(selected).length > 0 && (
                <>
                  <div className="w-px h-4 bg-slate-300" />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-1.5">Direct reportees</div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {reporteesOf(selected).map((r) => (
                      <span key={r.id} className="px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-700 border border-slate-200">{r.name}</span>
                    ))}
                  </div>
                </>
              )}
              {slackDeepLink(selected, directory.slack_team_id) ? (
                <a href={slackDeepLink(selected, directory.slack_team_id)} data-testid={`search-slack-button-${selected.id}`}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4A154B] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  <Slack className="h-4 w-4" /> Message {selected.name.split(" ")[0]} on Slack
                </a>
              ) : (
                <div className="mt-5 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg px-4 py-2" data-testid={`search-slack-missing-${selected.id}`}>
                  Slack ID not set for {selected.name} — admin can add it in Admin → Employees.
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
