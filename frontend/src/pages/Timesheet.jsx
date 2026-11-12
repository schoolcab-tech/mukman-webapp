import { useEffect, useMemo, useState } from "react";
import api, { errText } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, AlertTriangle, Check, X as XIcon, Download, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const STATUS_STYLE = {
  approved: "bg-emerald-100 text-emerald-800 border-emerald-300/50",
  pending: "bg-amber-100 text-amber-800 border-amber-300/50",
  rejected: "bg-rose-100 text-rose-800 border-rose-300/50",
};

const TASK_CATEGORIES = ["Core Activity", "Ad-hoc Activity assigned by team", "Other Activities"];
const DAY_MARKS = [
  { value: "present", label: "Present" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
];

const emptyTasks = () => TASK_CATEGORIES.map((c) => ({ category: c, hours: 0, note: "" }));
const workedDay = (status) => status === "present" || status === "half_day";

function statusLabel(status) {
  return DAY_MARKS.find((mark) => mark.value === status)?.label || (status ? status.charAt(0).toUpperCase() + status.slice(1) : "");
}

function formatGapDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

async function exportError(error) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return errText(parsed.detail);
    } catch {
      return "Export failed — check the date range or try again";
    }
  }
  return errText(data?.detail) || "Export failed — check the date range or try again";
}

function teamScope(people, user) {
  if (!user) return [];
  const children = new Map();
  for (const person of people) {
    if (!person.reports_to) continue;
    const key = String(person.reports_to);
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(person);
  }
  const scope = [];
  const seen = new Set();
  const stack = [...(children.get(String(user.id)) || [])];
  while (stack.length) {
    const person = stack.pop();
    if (!person || seen.has(person.id) || person.id === user.id) continue;
    seen.add(person.id);
    scope.push(person);
    stack.push(...(children.get(String(person.id)) || []));
  }
  for (const person of people) {
    if ((person.also_reports_to || []).includes(user.id) && !seen.has(person.id) && person.id !== user.id) {
      scope.push(person);
      seen.add(person.id);
    }
  }
  if (user.role === "admin") {
    for (const person of people) {
      if (!seen.has(person.id) && person.id !== user.id) {
        scope.push(person);
        seen.add(person.id);
      }
    }
  }
  return scope.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function tasksFromEntry(entry) {
  const saved = (entry?.tasks || []).map((task) => ({
    category: TASK_CATEGORIES.includes(task.category) ? task.category : "Core Activity",
    hours: task.hours ?? 0,
    note: task.note || "",
  }));
  return saved.length ? saved : emptyTasks();
}

function TaskBreakdown({ entry }) {
  const tasks = entry.tasks || [];
  if (!tasks.length) {
    return entry.achievements ? <p className="text-sm text-slate-600 mt-3 whitespace-pre-line bg-slate-50 rounded-xl p-3">{entry.achievements}</p> : null;
  }
  return (
    <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
            <th className="text-left px-3 py-2">Activity</th>
            <th className="text-left px-3 py-2 w-16">Hours</th>
            <th className="text-left px-3 py-2">What was done</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-700">{t.category}</td>
              <td className="px-3 py-2 font-mono2 text-slate-900">{t.hours}h</td>
              <td className="px-3 py-2 text-slate-600">{t.note || "—"}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-100 bg-slate-50/60">
            <td className="px-3 py-2 font-medium text-slate-500">Idle hours</td>
            <td className="px-3 py-2 font-mono2 text-slate-700">{entry.idle_hours || 0}h</td>
            <td className="px-3 py-2">
              {entry.idle_reason && <span className="text-slate-600 block">{entry.idle_reason}</span>}
              <span className="font-semibold text-slate-900">Total utilised: {entry.total_hours ?? entry.hours ?? 0}h</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Timesheet() {
  const { user } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [entries, setEntries] = useState({});
  const [approvals, setApprovals] = useState([]);
  const [rules, setRules] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ status: "present", tasks: emptyTasks(), idle_hours: 0, idle_reason: "", achievements: "" });
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState({});
  const [hasReportees, setHasReportees] = useState(false);
  const [people, setPeople] = useState([]);
  const [viewUser, setViewUser] = useState("");
  const [expPeriod, setExpPeriod] = useState("month");
  const [expStart, setExpStart] = useState("");
  const [expEnd, setExpEnd] = useState("");
  const [exporting, setExporting] = useState(false);
  const [personId, setPersonId] = useState("");
  const [personStart, setPersonStart] = useState("");
  const [personEnd, setPersonEnd] = useState("");
  const [exportingPerson, setExportingPerson] = useState(false);
  const [gaps, setGaps] = useState([]);

  const load = () => {
    const sheetUrl = viewUser
      ? `/timesheets/reportee?user_id=${viewUser}&month=${month}`
      : `/timesheets/my?month=${month}`;
    api.get(sheetUrl).then((r) => {
      const map = {};
      (Array.isArray(r.data) ? r.data : []).forEach((e) => { map[e.date] = e; });
      setEntries(map);
    }).catch((e) => {
      setEntries({});
      if (viewUser) toast.error(errText(e.response?.data?.detail));
    });
    if (user?.role === "admin") setHasReportees(true);
    api.get("/timesheets/approvals").then((r) => setApprovals(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/timesheets/gaps").then((r) => setGaps(Array.isArray(r.data) ? r.data : [])).catch(() => setGaps([]));
    api.get("/penalty-rules").then((r) => setRules((Array.isArray(r.data) ? r.data : []).filter((x) => x.enabled))).catch(() => {});
    api.get("/org-chart").then((r) => {
      const list = Array.isArray(r.data.people) ? r.data.people : [];
      setPeople(list);
      setHasReportees(
        user?.role === "admin" ||
        list.some((p) => p.reports_to === user.id || (p.also_reports_to || []).includes(user.id)),
      );
    }).catch(() => {});
  };

  useEffect(load, [month, viewUser]);

  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
    return cells;
  }, [month]);

  const shiftMonth = (delta) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const openDay = (date) => {
    const e = entries[date];
    if (e) {
      setForm({ status: e.status, tasks: tasksFromEntry(e), idle_hours: e.idle_hours || 0, idle_reason: e.idle_reason || "", achievements: e.achievements || "" });
    } else {
      setForm({ status: "present", tasks: emptyTasks(), idle_hours: 0, idle_reason: "", achievements: "" });
    }
    setSelected(date);
  };

  const totalHours = form.tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post("/timesheets", {
        date: selected, status: form.status,
        tasks: form.tasks.map((t) => ({ category: t.category, hours: Number(t.hours) || 0, note: t.note })),
        idle_hours: Number(form.idle_hours) || 0,
        idle_reason: form.idle_reason,
        achievements: form.achievements,
      });
      toast.success(`Timesheet for ${selected} submitted for approval`);
      setSelected(null);
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const review = async (id, action) => {
    try {
      await api.post(`/timesheets/${id}/${action}`, { comment: comments[id] || "" });
      toast.success(`Timesheet ${action}`);
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    }
  };

  const downloadExport = async () => {
    setExporting(true);
    try {
      const params = expPeriod === "custom" ? { period: "custom", start: expStart, end: expEnd } : { period: expPeriod };
      const res = await api.get("/timesheets/export", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mukman-team-${expPeriod}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Team workbook downloaded");
    } catch (e) {
      toast.error(await exportError(e));
    } finally {
      setExporting(false);
    }
  };

  const downloadPerson = async () => {
    const person = reportees.find((candidate) => candidate.id === personId);
    if (!person || !personStart || !personEnd || personStart > personEnd) {
      toast.error("Choose a person and a valid date range");
      return;
    }
    setExportingPerson(true);
    try {
      const res = await api.get("/timesheets/export", {
        params: { period: "custom", start: personStart, end: personEnd, user_id: person.id },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mukman-${person.name.replace(/\s+/g, "-")}-${personStart}-to-${personEnd}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${person.name}'s timesheet downloaded`);
    } catch (e) {
      toast.error(await exportError(e));
    } finally {
      setExportingPerson(false);
    }
  };

  const setTask = (i, patch) => {
    const tasks = form.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t));
    setForm({ ...form, tasks });
  };

  const addTask = () => {
    setForm({ ...form, tasks: [...form.tasks, { category: "Core Activity", hours: 0, note: "" }] });
  };

  const removeTask = (index) => {
    if (form.tasks.length <= 1) return;
    setForm({ ...form, tasks: form.tasks.filter((_, i) => i !== index) });
  };

  const canExport = user?.role === "admin" || hasReportees;
  const reportees = useMemo(() => teamScope(people, user), [people, user]);
  const openGap = (person) => {
    const latest = person.days?.[person.days.length - 1];
    if (latest) setMonth(latest.slice(0, 7));
    setSelected(null);
    if (person.id === user?.id) {
      setViewUser("");
      return;
    }
    if (reportees.some((candidate) => candidate.id === person.id)) setViewUser(person.id);
  };
  const viewed = reportees.find((person) => person.id === viewUser) || null;
  const reporteeEntries = Object.values(entries).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const monthLabel = new Date(`${month}-02`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayIso = new Date().toLocaleDateString("en-CA");

  return (
    <div className="space-y-8" data-testid="timesheet-page">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">WORK & COMPLIANCE</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">Timesheet & Calendar</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Allocate your day task-wise: core activity, ad-hoc work assigned by the team, other activities and idle hours.
          Your immediate senior approves each entry.
        </p>
      </div>

      {gaps.length > 0 && (
        <section className="rounded-2xl border border-red-300/60 bg-red-50 overflow-hidden" data-testid="timesheet-gap-alert">
          <div className="flex gap-3 items-start px-5 pt-5 pb-3">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-red-900">Timesheets not filled for more than 3 days</h2>
              <p className="text-xs text-red-700 mt-1">
                Working days with no timesheet, counted back from today until the last filled day. Sundays are not counted. Only people missing more than 3 days are listed.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto mx-3 mb-3 rounded-xl border border-red-100 bg-white">
            <table className="w-full text-sm" data-testid="timesheet-gap-table">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 w-56">Name</th>
                  <th className="px-4 py-3">Days not filled</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((person) => {
                  const days = Array.isArray(person.days) ? person.days : [];
                  const canOpen = person.id === user?.id || reportees.some((candidate) => candidate.id === person.id);
                  return (
                    <tr key={person.id} className="border-b border-slate-50 last:border-0 align-top" data-testid={`timesheet-gap-row-${person.id}`}>
                      <td className="px-4 py-3">
                        {canOpen ? (
                          <button type="button" onClick={() => openGap(person)} className="font-semibold text-slate-900 hover:underline text-left">
                            {person.name}
                          </button>
                        ) : (
                          <div className="font-semibold text-slate-900">{person.name}</div>
                        )}
                        <div className="text-xs text-red-700 mt-0.5">{days.length} days</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {days.map((day) => (
                            <span key={day} className="text-xs font-medium text-red-800 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
                              {formatGapDate(day)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canExport && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5" data-testid="timesheet-export-card">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-52">
              <div className="font-semibold text-slate-900">Export my team (Excel)</div>
              <p className="text-xs text-slate-500 mt-0.5">Timesheets, each activity, reviews, and feedback for people who report to you, including indirect and dotted-line reports.</p>
            </div>
            <Select value={expPeriod} onValueChange={setExpPeriod}>
              <SelectTrigger data-testid="timesheet-export-period-select" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            {expPeriod === "custom" && (
              <>
                <Input type="date" data-testid="timesheet-export-start-input" value={expStart} onChange={(e) => setExpStart(e.target.value)} className="w-40" />
                <Input type="date" data-testid="timesheet-export-end-input" value={expEnd} onChange={(e) => setExpEnd(e.target.value)} className="w-40" />
              </>
            )}
            <Button data-testid="timesheet-export-download-button" onClick={downloadExport}
              disabled={exporting || (expPeriod === "custom" && (!expStart || !expEnd))}
              className="bg-slate-900 hover:bg-slate-800 text-white">
              <Download className="h-4 w-4 mr-1.5" /> {exporting ? "Preparing…" : "Export team"}
            </Button>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-52">
              <div className="font-semibold text-slate-900">Export one person (Excel)</div>
              <p className="text-xs text-slate-500 mt-0.5">One reportee’s timesheet and each activity for any start and end date.</p>
            </div>
            <Select value={personId || undefined} onValueChange={setPersonId}>
              <SelectTrigger data-testid="timesheet-export-person-select" className="w-52"><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent>
                {reportees.map((person) => (
                  <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" data-testid="timesheet-export-person-start" value={personStart} onChange={(e) => setPersonStart(e.target.value)} className="w-40" />
            <Input type="date" data-testid="timesheet-export-person-end" value={personEnd} onChange={(e) => setPersonEnd(e.target.value)} className="w-40" />
            <Button data-testid="timesheet-export-person-button" onClick={downloadPerson}
              disabled={exportingPerson || !personId || !personStart || !personEnd || personStart > personEnd}
              className="bg-slate-900 hover:bg-slate-800 text-white">
              <Download className="h-4 w-4 mr-1.5" /> {exportingPerson ? "Preparing…" : "Export person"}
            </Button>
          </div>
        </section>
      )}

      {rules.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3" data-testid="timesheet-penalty-rules">
          {rules.map((r) => (
            <div key={r.key} className="flex gap-3 items-start rounded-xl border border-red-300/40 bg-red-50 p-4">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-red-900">{r.label} — {r.percent}% {r.applies_to === "esop" ? "ownership/ESOP" : "salary"} impact</div>
                <div className="text-xs text-red-700 mt-1">{r.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900" data-testid="timesheet-month-label">
              {viewed ? `${viewed.name} — ${monthLabel}` : monthLabel}
            </h2>
            {viewed && <p className="text-xs text-slate-500 mt-1">Submitted days for this month are listed here, including approved ones.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reportees.length > 0 && (
              <Select value={viewUser || "me"} onValueChange={(value) => { setSelected(null); setViewUser(value === "me" ? "" : value); }}>
                <SelectTrigger data-testid="timesheet-reportee-select" className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">My timesheet</SelectItem>
                  {reportees.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button data-testid="timesheet-prev-month" variant="outline" size="icon" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button data-testid="timesheet-next-month" variant="outline" size="icon" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        {viewed && (
          <div className="space-y-3 mb-6" data-testid="timesheet-reportee-list">
            {reporteeEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No timesheet submitted for {monthLabel}.</p>
            ) : reporteeEntries.map((entry) => (
              <div key={entry.id || entry.date} className="rounded-2xl border border-slate-200 p-4" data-testid={`timesheet-reportee-day-${entry.date}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{entry.date}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{statusLabel(entry.status)} · {entry.total_hours ?? entry.hours ?? 0}h utilised{(entry.idle_hours || 0) > 0 ? ` · ${entry.idle_hours}h idle` : ""}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wide ${STATUS_STYLE[entry.approval_status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{entry.approval_status}</span>
                </div>
                <TaskBreakdown entry={entry} />
                {entry.comments && <p className="text-xs text-slate-500 mt-2">Comment: {entry.comments}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold tracking-wider text-slate-400 mb-2">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {grid.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />;
            const e = entries[date];
            const st = e ? e.approval_status : null;
            const isFuture = date > todayIso;
            const missed = !e && !isFuture && new Date(date).getDay() !== 0;
            return (
              <button
                key={date}
                data-testid={`timesheet-day-${date}`}
                onClick={() => {
                  if (isFuture) return;
                  if (viewUser) { setSelected(date); return; }
                  openDay(date);
                }}
                disabled={isFuture}
                className={`aspect-square rounded-xl border text-sm font-medium flex flex-col items-center justify-center gap-0.5 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                  st ? STATUS_STYLE[st] : missed ? "border-red-300/60 bg-red-50/60 text-red-700 hover:bg-red-50" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{Number(date.slice(-2))}</span>
                {e && <span className="text-[9px] uppercase tracking-wide">{workedDay(e.status) ? `${st} · ${e.total_hours ?? e.hours ?? 0}h` : statusLabel(e.status)}</span>}
                {missed && <span className="text-[9px] uppercase tracking-wide">missing</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-200 border border-emerald-400/50" /> Approved</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-200 border border-amber-400/50" /> Pending approval</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-200 border border-rose-400/50" /> Rejected</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 border border-red-400/60" /> Missing</span>
        </div>
      </div>

      {approvals.length > 0 && (
        <section data-testid="timesheet-approvals-section">
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-4">Pending approvals from your team ({approvals.length})</h2>
          <div className="space-y-3">
            {approvals.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`timesheet-approval-card-${a.id}`}>
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{a.user_name} — {a.date}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{statusLabel(a.status)} · {a.total_hours ?? a.hours ?? 0}h utilised{(a.idle_hours || 0) > 0 ? ` · ${a.idle_hours}h idle` : ""}</div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300/40 font-semibold uppercase tracking-wide">Pending</span>
                </div>
                <TaskBreakdown entry={a} />
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Comment (optional)"
                    value={comments[a.id] || ""}
                    onChange={(e) => setComments({ ...comments, [a.id]: e.target.value })}
                    data-testid={`timesheet-comment-input-${a.id}`}
                    className="sm:flex-1"
                  />
                  <div className="flex gap-2">
                    <Button data-testid={`timesheet-approve-button-${a.id}`} onClick={() => review(a.id, "approve")} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button data-testid={`timesheet-reject-button-${a.id}`} onClick={() => review(a.id, "reject")} variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50">
                      <XIcon className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent data-testid="timesheet-entry-dialog" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Timesheet — {selected}</DialogTitle>
          </DialogHeader>
          {viewUser ? (
            entries[selected] ? (
              <div>
                <p className="text-sm text-slate-500 mb-3 capitalize">
                  {statusLabel(entries[selected].status)} · {entries[selected].approval_status}
                  {entries[selected].comments ? ` · ${entries[selected].comments}` : ""}
                </p>
                <TaskBreakdown entry={entries[selected]} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">No timesheet was submitted for this day.</p>
            )
          ) : entries[selected]?.approval_status === "approved" ? (
            <div>
              <p className="text-sm text-slate-500 mb-3">This day is approved and locked.</p>
              <TaskBreakdown entry={entries[selected]} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Mark the day</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="timesheet-day-mark">
                  {DAY_MARKS.map((mark) => (
                    <button
                      key={mark.value}
                      type="button"
                      data-testid={`timesheet-status-${mark.value}`}
                      onClick={() => setForm({ ...form, status: mark.value })}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        form.status === mark.value
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {mark.label}
                    </button>
                  ))}
                </div>
              </div>

              {workedDay(form.status) ? (
                <>
                  <div className="space-y-3" data-testid="timesheet-task-rows">
                    <div className="grid grid-cols-[1fr_90px_32px] sm:grid-cols-[220px_90px_1fr_32px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                      <span>Activity</span><span>Hours</span><span className="hidden sm:block">What you did</span>
                    </div>
                    {form.tasks.map((t, i) => (
                      <div key={i} className="grid grid-cols-[1fr_90px_32px] sm:grid-cols-[220px_90px_1fr_32px] gap-2 items-center" data-testid={`timesheet-task-row-${i}`}>
                        <Select value={t.category} onValueChange={(v) => setTask(i, { category: v })}>
                          <SelectTrigger data-testid={`timesheet-task-category-${i}`} className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input type="number" min="0" max="24" step="0.5" data-testid={`timesheet-task-hours-${i}`}
                          value={t.hours} onChange={(e) => setTask(i, { hours: e.target.value })} />
                        <Input placeholder="What you did…" data-testid={`timesheet-task-note-${i}`}
                          value={t.note} onChange={(e) => setTask(i, { note: e.target.value })}
                          className="col-span-2 sm:col-span-1" />
                        <button
                          type="button"
                          aria-label="Remove activity"
                          data-testid={`timesheet-task-remove-${i}`}
                          onClick={() => removeTask(i)}
                          disabled={form.tasks.length <= 1}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <XIcon className="h-3.5 w-3.5 mx-auto" />
                        </button>
                      </div>
                    ))}
                    <div className="grid grid-cols-[1fr_90px_32px] sm:grid-cols-[220px_90px_1fr_32px] gap-2 items-center" data-testid="timesheet-idle-row">
                      <div className="text-xs font-medium text-slate-500 px-1">Idle hours</div>
                      <Input type="number" min="0" max="24" step="0.5" data-testid="timesheet-idle-hours-input"
                        value={form.idle_hours} onChange={(e) => setForm({ ...form, idle_hours: e.target.value })} />
                      <Input placeholder={Number(form.idle_hours) > 0 ? "Reason for idle time (required — sick, travel, etc.)…" : "Reason for idle time…"}
                        data-testid="timesheet-idle-reason-input"
                        value={form.idle_reason} onChange={(e) => setForm({ ...form, idle_reason: e.target.value })}
                        className="col-span-2 sm:col-span-1" />
                    </div>
                    <button
                      type="button"
                      data-testid="timesheet-add-task"
                      onClick={addTask}
                      className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add activity
                    </button>
                    <p className="text-[11px] text-slate-400 -mt-1">Each row keeps its own hours, even when two tasks are the same type.</p>
                    <div className="flex items-center justify-between rounded-xl bg-slate-900 text-white px-4 py-3" data-testid="timesheet-total-hours">
                      <span className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-400">Total time utilised</span>
                      <span className="font-display font-bold text-lg">{totalHours}h <span className="text-xs text-slate-400 font-normal">(+{Number(form.idle_hours) || 0}h idle)</span></span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Key achievements of the day (optional)</Label>
                    <Textarea data-testid="timesheet-achievements-input" rows={2} value={form.achievements}
                      onChange={(e) => setForm({ ...form, achievements: e.target.value })}
                      placeholder="Anything notable worth highlighting…" />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Reason / note</Label>
                  <Textarea data-testid="timesheet-achievements-input" rows={3} value={form.achievements}
                    onChange={(e) => setForm({ ...form, achievements: e.target.value })}
                    placeholder="Reason for absence / leave…" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {entries[selected]?.approval_status !== "approved" && (
              <Button data-testid="timesheet-submit-button" onClick={submit} disabled={saving || (workedDay(form.status) && totalHours === 0) || (Number(form.idle_hours) > 0 && !form.idle_reason.trim())} className="bg-slate-900 hover:bg-slate-800 text-white">
                {saving ? "Submitting…" : "Submit for approval"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
