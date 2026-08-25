import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Sparkles, Shield, AlertCircle } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setLoading(true);
    setError(null);
    try {
      await login(demoEmail, "Password123!");
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen bg-[#090D16] text-slate-100 antialiased">
      {/* Left hero banner */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-slate-800 bg-[#0F1524] p-12 lg:flex">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl"></div>
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl"></div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 font-black text-xl text-white shadow-lg shadow-indigo-500/30">
            W
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">WorkforceAI</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Predictive Workforce Analytics
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-indigo-300 backdrop-blur-md">
            <Sparkles className="h-4 w-4" /> Next-Gen Workforce Intelligence
          </div>
          <h2 className="text-4xl font-extrabold leading-tight text-white">
            Predict Attrition, Bridge Skill Gaps & Empower Talent.
          </h2>
          <p className="text-base text-slate-400 max-w-md">
            Leverage machine learning algorithms, automated skill gap diagnostics, and targeted retention recommendations in one unified platform.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-slate-500">
          <Shield className="h-4 w-4 text-emerald-400" /> Enterprise-grade security with JWT authentication and audit trails.
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Sign In</h2>
            <p className="mt-2 text-sm text-slate-400">
              Enter your corporate credentials or choose a preloaded demo role below.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
              <p>{error}</p>
            </div>
          )}

          {/* Demo Quick Logins */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Instant 1-Click Demo Logins
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin("admin@workforce.local")}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 hover:border-indigo-500/50 hover:bg-indigo-600/10 transition-all text-center group"
              >
                <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300">HR Admin</span>
                <span className="text-[10px] text-slate-400">Full Access</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("manager@workforce.local")}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 hover:border-sky-500/50 hover:bg-sky-600/10 transition-all text-center group"
              >
                <span className="text-xs font-semibold text-slate-200 group-hover:text-sky-300">HR Manager</span>
                <span className="text-[10px] text-slate-400">Team Mgmt</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("employee@workforce.local")}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 hover:border-emerald-500/50 hover:bg-emerald-600/10 transition-all text-center group"
              >
                <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">Employee</span>
                <span className="text-[10px] text-slate-400">Self Service</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Corporate Email
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@workforce.local"
                className="w-full rounded-xl border border-slate-800 bg-[#0F1524] px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-800 bg-[#0F1524] px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-indigo-400 focus:outline-none disabled:opacity-50 transition-all"
            >
              {loading ? "Authenticating..." : "Sign In to Platform"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
