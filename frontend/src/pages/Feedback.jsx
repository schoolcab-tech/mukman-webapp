import { useEffect, useState } from "react";
import api, { errText } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

const STATUS_BADGE = {
  open: "bg-amber-100 text-amber-800 border-amber-300/40",
  forwarded: "bg-sky-100 text-sky-800 border-sky-300/40",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-300/40",
};

export default function Feedback() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [mine, setMine] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get("/feedback/my").then((r) => setMine(r.data)).catch(() => {});
    api.get("/feedback/inbox").then((r) => setInbox(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return toast.error("Subject and message are required");
    setSaving(true);
    try {
      await api.post("/feedback", { subject, message });
      toast.success("Feedback sent to your senior");
      setSubject(""); setMessage("");
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, action) => {
    try {
      await api.post(`/feedback/${id}/${action}`);
      toast.success(action === "forward" ? "Forwarded to your senior" : "Marked resolved");
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-8" data-testid="feedback-page">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">WORK & COMPLIANCE</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">Feedback & Grievances</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">Share feedback with your immediate senior. They can resolve it or escalate it upward — all the way to the founder.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4 max-w-2xl">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input data-testid="feedback-subject-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What is this about?" />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea data-testid="feedback-message-input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your feedback, idea or concern…" />
        </div>
        <Button data-testid="feedback-submit-button" onClick={submit} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
          {saving ? "Sending…" : "Send to my senior"}
        </Button>
      </div>

      {inbox.length > 0 && (
        <section data-testid="feedback-inbox-section">
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-4">Assigned to you ({inbox.length})</h2>
          <div className="space-y-3">
            {inbox.map((f) => (
              <div key={f.id} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`feedback-inbox-card-${f.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{f.subject}</div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wide ${STATUS_BADGE[f.status]}`}>{f.status}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">From {f.user_name} · {new Date(f.created_at).toLocaleDateString("en-IN")}</div>
                <p className="text-sm text-slate-600 mt-3 whitespace-pre-line bg-slate-50 rounded-xl p-3">{f.message}</p>
                <div className="flex gap-2 mt-4">
                  <Button data-testid={`feedback-forward-button-${f.id}`} size="sm" variant="outline" onClick={() => act(f.id, "forward")}>
                    <ArrowUpRight className="h-4 w-4 mr-1" /> Forward upward
                  </Button>
                  <Button data-testid={`feedback-resolve-button-${f.id}`} size="sm" onClick={() => act(f.id, "resolve")} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl font-semibold text-slate-900 mb-4">My feedback</h2>
        <div className="space-y-3">
          {mine.length === 0 && <p className="text-sm text-slate-500" data-testid="feedback-empty">You haven't sent any feedback yet.</p>}
          {mine.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`feedback-card-${f.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{f.subject}</div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wide ${STATUS_BADGE[f.status]}`} data-testid={`feedback-status-${f.id}`}>{f.status}</span>
              </div>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{f.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
