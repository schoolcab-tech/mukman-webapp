import { useEffect, useState } from "react";
import api, { errText } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Check, X as XIcon } from "lucide-react";

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-800 border-amber-300/40",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-300/40",
  rejected: "bg-rose-100 text-rose-800 border-rose-300/40",
};

function currentLabel(type) {
  const d = new Date();
  const y = d.getFullYear();
  if (type === "weekly") {
    const onejan = new Date(y, 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, "0")}`;
  }
  if (type === "monthly") return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (type === "quarterly") return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  return `${y}`;
}

export default function Reviews() {
  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState([]);
  const [periodType, setPeriodType] = useState("weekly");
  const [periodLabel, setPeriodLabel] = useState(currentLabel("weekly"));
  const [content, setContent] = useState("");
  const [comments, setComments] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get("/reviews/my").then((r) => setMine(r.data)).catch(() => {});
    api.get("/reviews/pending").then((r) => setPending(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const changeType = (t) => {
    setPeriodType(t);
    setPeriodLabel(currentLabel(t));
  };

  const submit = async () => {
    if (!content.trim()) return toast.error("Write your summary first");
    setSaving(true);
    try {
      await api.post("/reviews", { period_type: periodType, period_label: periodLabel, content });
      toast.success(`${periodType} review submitted to your senior`);
      setContent("");
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, action) => {
    try {
      await api.post(`/reviews/${id}/${action}`, { comment: comments[id] || "" });
      toast.success(`Review ${action}`);
      load();
    } catch (e) {
      toast.error(errText(e.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="reviews-page">
      <div>
        <div className="text-xs font-semibold tracking-[0.15em] uppercase text-slate-400">WORK & COMPLIANCE</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">Periodic Reviews</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Weekly summaries are due by the following Tuesday. Reviews flow to your immediate senior and then up the chain for final approval.
          Missing 3 consecutive weekly or 2 monthly summaries triggers the penalty policy.
        </p>
      </div>

      <Tabs defaultValue="submit">
        <TabsList data-testid="reviews-tabs">
          <TabsTrigger value="submit" data-testid="reviews-tab-submit">Submit Review</TabsTrigger>
          <TabsTrigger value="my" data-testid="reviews-tab-my">My Reviews ({mine.length})</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="reviews-tab-approvals">Approvals ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 max-w-2xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Review cycle</Label>
                <Select value={periodType} onValueChange={changeType}>
                  <SelectTrigger data-testid="review-period-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Input data-testid="review-period-label-input" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Significant wins, progress & blockers</Label>
              <Textarea data-testid="review-content-input" rows={7} value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="Summarise all significant upside and good items from this period…" />
            </div>
            <Button data-testid="review-submit-button" onClick={submit} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
              {saving ? "Submitting…" : "Submit to senior"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="my">
          <div className="space-y-3">
            {mine.length === 0 && <p className="text-sm text-slate-500" data-testid="reviews-empty">No reviews submitted yet.</p>}
            {mine.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`review-card-${r.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900 capitalize">{r.period_type} · <span className="font-mono2 text-sm">{r.period_label}</span></div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wide ${STATUS_BADGE[r.status]}`} data-testid={`review-status-${r.id}`}>{r.status}</span>
                </div>
                <p className="text-sm text-slate-600 mt-3 whitespace-pre-line">{r.content}</p>
                {r.chain?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                    {r.chain.map((c, i) => (
                      <div key={i} className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{c.name}</span> {c.action}
                        {c.comment ? ` — “${c.comment}”` : ""} · {new Date(c.at).toLocaleDateString("en-IN")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <div className="space-y-3">
            {pending.length === 0 && <p className="text-sm text-slate-500" data-testid="review-approvals-empty">Nothing waiting on you.</p>}
            {pending.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`review-approval-card-${r.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{r.user_name} — <span className="capitalize">{r.period_type}</span> <span className="font-mono2 text-sm">{r.period_label}</span></div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300/40 font-semibold uppercase tracking-wide">Pending with you</span>
                </div>
                <p className="text-sm text-slate-600 mt-3 whitespace-pre-line bg-slate-50 rounded-xl p-3">{r.content}</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <Input placeholder="Comment (optional)" value={comments[r.id] || ""} onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })}
                    data-testid={`review-comment-input-${r.id}`} className="sm:flex-1" />
                  <div className="flex gap-2">
                    <Button data-testid={`review-approve-button-${r.id}`} onClick={() => act(r.id, "approve")} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button data-testid={`review-reject-button-${r.id}`} onClick={() => act(r.id, "reject")} variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50">
                      <XIcon className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
