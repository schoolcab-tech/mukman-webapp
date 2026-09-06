import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { errText } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwzfHxjb3Jwb3JhdGUlMjB0ZWFtJTIwd29ya2luZyUyMG9mZmljZXxlbnwwfHx8fDE3ODg3MTQ4MDJ8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err) {
      setError(errText(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950" data-testid="login-page">
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <div className="font-display text-3xl font-bold text-white tracking-tight" data-testid="login-brand">
              MUKMAN <span className="text-cyan-400">GROUP</span>
            </div>
            <p className="text-slate-400 mt-2 text-sm">Internal portal for the team fixing recurring mobility in India — SchoolCab · Cabzee · Mukman Advisory.</p>
          </div>

          <form onSubmit={submit} className="space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-slate-300">Email or Phone Number</Label>
              <Input
                id="identifier"
                data-testid="login-email-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@mukman.in or 9000000002"
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500 h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500 h-11"
                required
              />
            </div>
            {error && (
              <div data-testid="login-error" className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold transition-colors"
            >
              {loading ? "Signing in…" : "Sign in to Portal"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
          <p className="text-slate-500 text-xs mt-8">Credentials are issued by the Mukman admin team. Contact your manager if you cannot sign in.</p>
        </div>
      </div>

      <div className="hidden lg:block relative">
        <img src={HERO_IMG} alt="Mukman team at work" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />
        <div className="absolute bottom-0 p-12">
          <div className="text-xs font-semibold tracking-[0.2em] text-cyan-400 mb-3">RECURRING RIDES. ZERO STRESS.</div>
          <h2 className="font-display text-4xl font-bold text-white leading-tight max-w-lg">
            One platform for every fixed-route ride in India.
          </h2>
          <p className="text-slate-300 mt-4 max-w-md text-sm leading-relaxed">
            School runs, office commutes, and every ride that repeats — owned end-to-end by the Mukman Group.
          </p>
        </div>
      </div>
    </div>
  );
}
