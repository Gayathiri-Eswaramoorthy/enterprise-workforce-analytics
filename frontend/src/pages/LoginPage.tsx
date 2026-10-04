import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import { Sparkles, Shield, AlertCircle } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
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
    } catch (err) {
      setError(getErrorMessage(err, "Authentication failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("demo1234");
    setLoading(true);
    setError(null);
    try {
      await login(demoEmail, "demo1234");
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err, "Demo login failed"));
    } finally {
      setLoading(false);
    }
  };

  // Already signed in (e.g. opened /login in a new tab): go straight to the app
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen w-screen bg-[#F8FAFC] text-slate-800 antialiased">
      {/* Left hero banner */}
      <div className="relative hidden w-1/2 flex-col justify-between border-r border-slate-200 bg-white p-12 lg:flex">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-black text-xl text-white shadow-sm">
            W
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">WorkforceAI</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Predictive platform
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            <Sparkles className="h-4 w-4 text-indigo-600" /> Enterprise Workforce Analytics Platform
          </div>
          <h2 className="text-3xl font-extrabold leading-tight text-slate-900">
            Predict Attrition, Bridge Skill Gaps & Empower Talent.
          </h2>
          <p className="text-sm text-slate-600 max-w-md">
            Leverage machine learning algorithms, automated skill gap diagnostics, and targeted retention recommendations in one unified platform.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs text-slate-500">
          <Shield className="h-4 w-4 text-emerald-600" /> Enterprise-grade security with JWT authentication and audit trails.
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex flex-1 flex-col justify-center bg-[#F8FAFC] px-8 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign In</h2>
            <p className="mt-1.5 text-xs text-slate-500">
              Enter your corporate credentials or choose a preloaded demo role below.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600" />
              <p>{error}</p>
            </div>
          )}

          {/* Demo Quick Logins */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Instant 1-Click Demo Logins
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin("admin@workforce.local")}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group"
              >
                <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700">HR Admin</span>
                <span className="text-[10px] text-slate-500">Full Access</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("user@workforce.local")}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group"
              >
                <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700">HR Manager</span>
                <span className="text-[10px] text-slate-500">Team Mgmt</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("demo@workforce.local")}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group"
              >
                <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700">Employee</span>
                <span className="text-[10px] text-slate-500">Self Service</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Corporate Email
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@workforce.local / user@workforce.local / demo@workforce.local"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none disabled:opacity-50 transition-all mt-2"
            >
              {loading ? "Authenticating..." : "Sign In to Platform"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
