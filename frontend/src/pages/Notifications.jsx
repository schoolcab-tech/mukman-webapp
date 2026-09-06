import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, MessageCircle, Megaphone, CheckCheck, AlertTriangle, Info } from "lucide-react";

const TYPE_META = {
  approval_request: { label: "Approval", cls: "bg-amber-100 text-amber-800 border-amber-300/40", icon: Bell, tab: "approvals" },
  status_update: { label: "Update", cls: "bg-sky-100 text-sky-800 border-sky-300/40", icon: Info, tab: "system" },
  penalty_warning: { label: "Penalty Warning", cls: "bg-red-100 text-red-900 border-red-400/40", icon: AlertTriangle, tab: "system" },
  broadcast: { label: "Broadcast", cls: "bg-slate-900 text-cyan-300 border-cyan-500/30", icon: Megaphone, tab: "broadcasts" },
  info: { label: "Info", cls: "bg-slate-100 text-slate-700 border-slate-300/40", icon: Info, tab: "system" },
};

export default function Notifications() {
  const [items, setItems] = useState([]);

  const load = () => api.get("/notifications").then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  const renderList = (filter) => {
    const list = items.filter((n) => filter === "all" || (TYPE_META[n.type]?.tab || "system") === filter);
    if (list.length === 0) return <p className="text-sm text-slate-500 py-6" data-testid="notifications-empty">Nothing here yet.</p>;
    return (
      <div className="space-y-3">
        {list.map((n) => {
          const meta = TYPE_META[n.type] || TYPE_META.info;
          return (
            <div key={n.id} data-testid={`notification-card-${n.id}`}
              className={`bg-white rounded-2xl border p-5 transition-colors ${n.read ? "border-slate-200" : "border-cyan-400/50 shadow-sm"}`}>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <meta.icon className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold text-slate-900 text-sm">{n.title}</span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-cyan-500" />}
                </div>
                <div className="flex items-center gap-2">
                  {n.channel === "whatsapp_mock" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/40 flex items-center gap-1" data-testid={`notification-whatsapp-badge-${n.id}`}>
                      <MessageCircle className="h-3 w-3" /> WhatsApp (mock)
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{n.message}</p>
              <div className="text-[11px] text-slate-400 mt-2">{new Date(n.created_at).toLocaleString("en-IN")}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">OPERATIONS & CONTROL</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">Notification Hub</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Approvals, system alerts, penalty reminders and broadcasts. Items tagged “WhatsApp (mock)” simulate the WhatsApp messages employees receive on their phones.
          </p>
        </div>
        <Button data-testid="notifications-mark-all-read" variant="outline" onClick={markAll}>
          <CheckCheck className="h-4 w-4 mr-2" /> Mark all read
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList data-testid="notifications-tabs">
          <TabsTrigger value="all" data-testid="notifications-tab-all">All</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="notifications-tab-approvals">Approvals</TabsTrigger>
          <TabsTrigger value="system" data-testid="notifications-tab-system">System Alerts</TabsTrigger>
          <TabsTrigger value="broadcasts" data-testid="notifications-tab-broadcasts">Broadcasts</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{renderList("all")}</TabsContent>
        <TabsContent value="approvals">{renderList("approvals")}</TabsContent>
        <TabsContent value="system">{renderList("system")}</TabsContent>
        <TabsContent value="broadcasts">{renderList("broadcasts")}</TabsContent>
      </Tabs>
    </div>
  );
}
