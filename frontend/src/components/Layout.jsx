import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  LayoutGrid, TrendingUp, Award, Sparkles, Calendar, FileCheck,
  MessageSquareText, Network, BellRing, ShieldAlert, LogOut, Menu, X, Bell,
} from "lucide-react";

const SECTIONS = [
  {
    label: "CORE PORTAL",
    items: [
      { to: "/", name: "Vision & Brands", icon: LayoutGrid, id: "overview" },
      { to: "/valuation", name: "Valuation & Market Cap", icon: TrendingUp, id: "metrics" },
      { to: "/achievements", name: "Milestones & Achievements", icon: Award, id: "achievements" },
      { to: "/benefits", name: "Employee Benefits", icon: Sparkles, id: "benefits" },
    ],
  },
  {
    label: "WORK & COMPLIANCE",
    items: [
      { to: "/timesheet", name: "Timesheet & Calendar", icon: Calendar, id: "timesheets" },
      { to: "/reviews", name: "Periodic Reviews", icon: FileCheck, id: "reviews" },
      { to: "/feedback", name: "Feedback & Grievances", icon: MessageSquareText, id: "feedback" },
      { to: "/org-chart", name: "Org Chart", icon: Network, id: "orgchart" },
    ],
  },
  {
    label: "OPERATIONS & CONTROL",
    items: [
      { to: "/notifications", name: "Notification Hub", icon: BellRing, id: "notifications" },
      { to: "/admin", name: "Admin Console", icon: ShieldAlert, id: "admin", adminOnly: true },
    ],
  },
];

function SidebarContent({ user, onNavigate }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 bg-slate-900 m-3 rounded-2xl">
        <div className="font-display font-800 text-white text-lg font-bold tracking-tight" data-testid="sidebar-brand">MUKMAN <span className="text-cyan-400">GROUP</span></div>
        <div className="text-xs text-slate-400 mt-1">Internal Employee Portal</div>
      </div>
      <nav className="flex-1 px-3 space-y-5 overflow-y-auto pb-4">
        {SECTIONS.map((sec) => (
          <div key={sec.label}>
            <div className="px-3 mb-2 text-[10px] font-semibold tracking-[0.15em] text-slate-400">{sec.label}</div>
            <div className="space-y-1">
              {sec.items.filter((i) => !i.adminOnly || user.role === "admin").map((item) => (
                <NavLink
                  key={item.id}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onNavigate}
                  data-testid={`sidebar-nav-${item.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                      isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    api.get("/notifications").then((r) => {
      const list = r.data || [];
      setUnread(list.filter((n) => !n.read).length);
      const p = list.find((n) => n.popup && !n.read);
      if (p) setPopup(p);
    }).catch(() => {});
  }, []);

  const acknowledgePopup = async () => {
    if (!popup) return;
    try { await api.post(`/notifications/${popup.id}/read`); } catch (e) { /* ignore */ }
    setUnread((u) => Math.max(0, u - 1));
    setPopup(null);
  };

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="app-layout">
      <aside className="hidden md:block w-64 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 h-screen">
        <SidebarContent user={user} onNavigate={() => {}} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl">
            <div className="flex justify-end p-2">
              <button data-testid="mobile-menu-close" onClick={() => setMobileOpen(false)} className="p-2 text-slate-500"><X className="h-5 w-5" /></button>
            </div>
            <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 h-16 backdrop-blur-xl bg-white/85 border-b border-slate-200/80 flex items-center gap-3 px-4 sm:px-6">
          <button data-testid="mobile-menu-button" className="md:hidden p-2 text-slate-600" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-slate-900 truncate">{user.name}</div>
            <div className="text-xs text-slate-500 truncate">{user.title || user.department || "Team Member"}</div>
          </div>
          <button
            data-testid="header-notifications-button"
            onClick={() => navigate("/notifications")}
            className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span data-testid="header-notifications-badge" className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-cyan-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="h-8 w-8 rounded-full bg-slate-900 text-cyan-400 flex items-center justify-center text-xs font-bold font-display" data-testid="header-user-avatar">
              {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <Button data-testid="header-logout-button" variant="ghost" size="sm" onClick={doLogout} className="text-slate-500 hover:text-slate-900">
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <Dialog open={!!popup} onOpenChange={(o) => { if (!o) acknowledgePopup(); }}>
        <DialogContent data-testid="broadcast-popup">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <BellRing className="h-5 w-5 text-cyan-500" /> {popup?.title}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-wrap pt-2 text-slate-600">{popup?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button data-testid="broadcast-acknowledge-button" onClick={acknowledgePopup} className="bg-slate-900 hover:bg-slate-800 text-white">
              Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
