import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { errText } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

export default function ChangePassword() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (next !== confirm) return setError("New passwords do not match");
    if (next.length < 6) return setError("New password must be at least 6 characters");
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      setUser({ ...user, must_change_password: false });
      navigate("/");
    } catch (err) {
      setError(errText(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6" data-testid="change-password-page">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-cyan-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white mt-4" data-testid="change-password-title">Set your own password</h1>
          <p className="text-slate-400 text-sm mt-2">For security, please change the password issued by the admin before continuing{user?.name ? `, ${user.name}` : ""}.</p>
        </div>
        <form onSubmit={submit} className="space-y-4" data-testid="change-password-form">
          <div className="space-y-2">
            <Label className="text-slate-300">Current password</Label>
            <Input type="password" data-testid="change-current-password-input" value={current} onChange={(e) => setCurrent(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white focus-visible:ring-cyan-500 h-11" required />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">New password</Label>
            <Input type="password" data-testid="change-new-password-input" value={next} onChange={(e) => setNext(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white focus-visible:ring-cyan-500 h-11" required />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Confirm new password</Label>
            <Input type="password" data-testid="change-confirm-password-input" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white focus-visible:ring-cyan-500 h-11" required />
          </div>
          {error && (
            <div data-testid="change-password-error" className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg px-3 py-2">{error}</div>
          )}
          <Button type="submit" data-testid="change-password-submit-button" disabled={saving}
            className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold">
            {saving ? "Updating…" : "Update password & continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
