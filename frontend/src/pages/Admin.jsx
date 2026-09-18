import { useEffect, useState } from "react";
import api, { errText } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Wand2, Plus, Pencil, Megaphone, UserX, UserCheck } from "lucide-react";

const CONTENT_SECTIONS = [
  { key: "vision", label: "Group Vision" },
  { key: "brand_schoolcab", label: "SchoolCab Brand" },
  { key: "brand_cabzee", label: "Cabzee Brand" },
  { key: "brand_advisory", label: "Mukman Advisory Brand" },
  { key: "achievements", label: "Achievements" },
  { key: "valuation", label: "Valuation & Market" },
  { key: "benefits", label: "Employee Benefits" },
];

const EMPTY_EMP = { name: "", email: "", phone: "", password: "", title: "", department: "", reports_to: "", role: "employee", esop_applicable: false, active: true, slack_id: "" };

const AI_MODELS = [
  { id: "gpt-5.4", label: "ChatGPT · GPT-5.4" },
  { id: "gpt-5.4-mini", label: "ChatGPT · GPT-5.4 Mini" },
  { id: "claude-sonnet-5", label: "Claude · Sonnet 5" },
  { id: "claude-sonnet-4-6", label: "Claude · Sonnet 4.6" },
];

function ContentEditor() {
  const [content, setContent] = useState({});
  const [section, setSection] = useState("vision");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [statsJson, setStatsJson] = useState("");
  const [tone, setTone] = useState("corporate");
  const [model, setModel] = useState("gpt-5.4");
  const [enhancing, setEnhancing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/content").then((r) => setContent(r.data || {})).catch(() => {});
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const doc = content[section];
    setTitle(doc?.title || "");
    setBody(doc?.body || "");
    setStatsJson(doc?.stats ? JSON.stringify(doc.stats, null, 2) : "");
  }, [section, content]);

  const enhance = async () => {
    if (!body.trim()) return toast.error("Write a rough draft first, then enhance it");
    setEnhancing(true);
    try {
      const { data } = await api.post("/admin/ai-enhance", { text: body, section, tone, model });
      setBody(data.enhanced);
      toast.success(`Enhanced with ${AI_MODELS.find((m) => m.id === data.model)?.label || data.model} — review and save`);
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    } finally {
      setEnhancing(false);
    }
  };

  const save = async () => {
    let stats;
    if (statsJson.trim()) {
      try { stats = JSON.parse(statsJson); } catch { return toast.error("Stats JSON is invalid"); }
    }
    setSaving(true);
    try {
      await api.put(`/admin/content/${section}`, { title, body, stats });
      toast.success("Content published to the portal");
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Portal section</Label>
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger data-testid="admin-content-section-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTENT_SECTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>AI model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger data-testid="admin-ai-model-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((m) => <SelectItem key={m.id} value={m.id} data-testid={`admin-ai-model-option-${m.id}`}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>AI tone</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger data-testid="admin-ai-tone-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="inspiring">Inspiring</SelectItem>
              <SelectItem value="high-impact">High Impact</SelectItem>
              <SelectItem value="concise">Concise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Title</Label>
        <Input data-testid="admin-content-title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Body content</Label>
          <Button data-testid={`admin-ai-enhance-button-${section}`} size="sm" variant="outline" onClick={enhance} disabled={enhancing}
            className="border-cyan-400/50 text-cyan-700 hover:bg-cyan-50">
            <Wand2 className="h-4 w-4 mr-1.5" /> {enhancing ? "Enhancing with AI…" : "Enhance with AI"}
          </Button>
        </div>
        <Textarea data-testid="admin-content-body-input" rows={12} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Write rough content here — AI will polish it into portal-ready copy…" />
      </div>
      {(section === "achievements" || section === "valuation") && (
        <div className="space-y-2">
          <Label>Stat cards (JSON — optional)</Label>
          <Textarea data-testid="admin-content-stats-input" rows={4} value={statsJson} onChange={(e) => setStatsJson(e.target.value)}
            className="font-mono2 text-xs" placeholder='[{"label":"Vehicles","value":"17","sub":"deployed"}]' />
        </div>
      )}
      <Button data-testid="admin-save-content-button" onClick={save} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
        {saving ? "Publishing…" : "Publish to portal"}
      </Button>
    </div>
  );
}

function EmployeeManager() {
  const [employees, setEmployees] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_EMP);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get("/admin/employees").then((r) => setEmployees(r.data)).catch(() => {});
    api.get("/org-chart").then((r) => setDirectory(r.data.people || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY_EMP); setOpen(true); };
  const openEdit = (e) => {
    setEditing(e);
    setForm({ name: e.name, email: e.email, phone: e.phone || "", password: "", title: e.title || "", department: e.department || "",
      reports_to: e.reports_to || "", role: e.role, esop_applicable: !!e.esop_applicable, active: !!e.active, slack_id: e.slack_id || "" });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...form, reports_to: form.reports_to || null, password: form.password || null };
    try {
      if (editing) await api.put(`/admin/employees/${editing.id}`, payload);
      else await api.post("/admin/employees", payload);
      toast.success(editing ? "Employee updated" : "Employee added");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (e) => {
    try {
      await api.put(`/admin/employees/${e.id}`, { name: e.name, email: e.email, phone: e.phone || "", title: e.title || "",
        department: e.department || "", reports_to: e.reports_to || null, role: e.role, esop_applicable: !!e.esop_applicable, active: !e.active });
      toast.success(e.active ? `${e.name} deactivated` : `${e.name} reactivated`);
      load();
    } catch (err) {
      toast.error(errText(err.response?.data?.detail));
    }
  };

  const managerName = (id) => employees.find((e) => e.id === id)?.name || "—";
  const mgrOptions = editing ? directory.filter((d) => d.id !== editing.id) : directory;

  return (
    <div className="space-y-4" data-testid="admin-employees-section">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{employees.length} people in the group. New employees default to password <span className="font-mono2">Schoolcab@1</span> and are asked to set their own password on first login. Setting a password here resets it and forces a change on their next login.</p>
        <Button data-testid="admin-add-employee-button" onClick={openAdd} className="bg-slate-900 hover:bg-slate-800 text-white">
          <Plus className="h-4 w-4 mr-1.5" /> Add Employee
        </Button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm" data-testid="admin-employees-table">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3">Name</th><th className="px-5 py-3">Title</th><th className="px-5 py-3">Reports To</th>
              <th className="px-5 py-3">ESOP</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/60" data-testid={`admin-employee-row-${e.id}`}>
                <td className="px-5 py-3">
                  <div className="font-semibold text-slate-900">{e.name}</div>
                  <div className="text-xs text-slate-400">{e.email} · {e.phone}</div>
                </td>
                <td className="px-5 py-3 text-slate-600">{e.title || "—"}</td>
                <td className="px-5 py-3 text-slate-600">{managerName(e.reports_to)}</td>
                <td className="px-5 py-3">{e.esop_applicable ? <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">Yes</span> : <span className="text-xs text-slate-400">No</span>}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`} data-testid={`admin-employee-status-${e.id}`}>
                    {e.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" data-testid={`admin-edit-employee-${e.id}`} onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" data-testid={`admin-toggle-employee-${e.id}`} onClick={() => toggleActive(e)}>
                      {e.active ? <UserX className="h-4 w-4 text-rose-500" /> : <UserCheck className="h-4 w-4 text-emerald-600" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="admin-employee-dialog" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? `Edit ${editing.name}` : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Name</Label><Input data-testid="employee-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input data-testid="employee-email-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone (WhatsApp)</Label><Input data-testid="employee-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Slack member ID (e.g. U012ABC3DEF)</Label><Input data-testid="employee-slack-input" value={form.slack_id} onChange={(e) => setForm({ ...form, slack_id: e.target.value })} placeholder="From their Slack profile → More → Copy member ID" /></div>
            <div className="space-y-2"><Label>{editing ? "Reset password (forces change on next login)" : "Password (optional)"}</Label><Input data-testid="employee-password-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-2"><Label>Title</Label><Input data-testid="employee-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department</Label><Input data-testid="employee-department-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Reports to</Label>
              <Select value={form.reports_to || "none"} onValueChange={(v) => setForm({ ...form, reports_to: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="employee-manager-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager (top)</SelectItem>
                  {mgrOptions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} — {d.title || d.department}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="employee-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch data-testid="employee-esop-switch" checked={form.esop_applicable} onCheckedChange={(v) => setForm({ ...form, esop_applicable: v })} />
              <Label>ESOP / ownership eligible (ESOP penalty rules apply)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="employee-save-button" onClick={save} disabled={saving || !form.name || !form.email} className="bg-slate-900 hover:bg-slate-800 text-white">
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PenaltyRules() {
  const [rules, setRules] = useState([]);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/penalty-rules").then((r) => {
    setRules(r.data);
    const map = {};
    r.data.forEach((x) => { map[x.key] = { percent: x.percent, description: x.description, enabled: x.enabled }; });
    setEdits(map);
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const r of rules) await api.put(`/admin/penalty-rules/${r.key}`, edits[r.key]);
      toast.success("Penalty rules updated");
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl" data-testid="admin-penalty-section">
      <p className="text-sm text-slate-500">Configure penalty percentages and the notification text employees receive when they default.</p>
      {rules.map((r) => (
        <div key={r.key} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3" data-testid={`penalty-rule-card-${r.key}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-semibold text-slate-900">{r.label}</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Input type="number" min="0" max="100" className="w-20" data-testid={`penalty-percent-input-${r.key}`}
                  value={edits[r.key]?.percent ?? r.percent}
                  onChange={(e) => setEdits({ ...edits, [r.key]: { ...edits[r.key], percent: Number(e.target.value) } })} />
                <span className="text-sm text-slate-500">% {r.applies_to === "esop" ? "ownership/ESOP" : "salary"}</span>
              </div>
              <Switch data-testid={`penalty-enabled-switch-${r.key}`} checked={edits[r.key]?.enabled ?? r.enabled}
                onCheckedChange={(v) => setEdits({ ...edits, [r.key]: { ...edits[r.key], enabled: v } })} />
            </div>
          </div>
          <Textarea rows={2} data-testid={`penalty-description-input-${r.key}`} value={edits[r.key]?.description ?? r.description}
            onChange={(e) => setEdits({ ...edits, [r.key]: { ...edits[r.key], description: e.target.value } })} />
        </div>
      ))}
      <Button data-testid="admin-save-penalty-rules-button" onClick={saveAll} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
        {saving ? "Saving…" : "Save penalty rules"}
      </Button>
    </div>
  );
}

function Broadcast() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !message.trim()) return toast.error("Title and message are required");
    setSending(true);
    try {
      const { data } = await api.post("/admin/broadcast", { title, message });
      toast.success(`Broadcast sent as popup to ${data.sent} people`);
      setTitle(""); setMessage("");
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl" data-testid="admin-broadcast-section">
      <p className="text-sm text-slate-500">Publish an urgent announcement. Every active employee sees it as a popup the next time they open the portal.</p>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="space-y-2"><Label>Title</Label><Input data-testid="broadcast-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. All-hands meeting Friday 5pm" /></div>
        <div className="space-y-2"><Label>Message</Label><Textarea data-testid="broadcast-message-input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <Button data-testid="admin-broadcast-popup-button" onClick={send} disabled={sending} className="bg-slate-900 hover:bg-slate-800 text-white">
          <Megaphone className="h-4 w-4 mr-1.5" /> {sending ? "Sending…" : "Send broadcast popup"}
        </Button>
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <div className="space-y-6" data-testid="admin-page">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">OPERATIONS & CONTROL</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">Admin Console</h1>
        <p className="text-sm text-slate-500 mt-2">Manage people, hierarchy, portal content (with AI assist), penalty rules and broadcasts.</p>
      </div>
      <Tabs defaultValue="content">
        <TabsList data-testid="admin-tabs">
          <TabsTrigger value="content" data-testid="admin-tab-content">Content & AI</TabsTrigger>
          <TabsTrigger value="employees" data-testid="admin-tab-employees">Employees</TabsTrigger>
          <TabsTrigger value="penalties" data-testid="admin-tab-penalties">Penalty Rules</TabsTrigger>
          <TabsTrigger value="broadcast" data-testid="admin-tab-broadcast">Broadcast</TabsTrigger>
        </TabsList>
        <TabsContent value="content"><ContentEditor /></TabsContent>
        <TabsContent value="employees"><EmployeeManager /></TabsContent>
        <TabsContent value="penalties"><PenaltyRules /></TabsContent>
        <TabsContent value="broadcast"><Broadcast /></TabsContent>
      </Tabs>
    </div>
  );
}
