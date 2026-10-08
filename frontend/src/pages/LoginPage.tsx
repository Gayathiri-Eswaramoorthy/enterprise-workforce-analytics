import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CircleHelp,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Info,
  Lock,
  Mail,
  Sparkles,
  Target,
  TrendingUp,
  User,
  UserRound,
  Users,
  ShieldCheck,
  ChartColumn,
} from "lucide-react";

const REMEMBER_KEY = "wf-remembered-email";
const DEMO_PASSWORD = "demo1234";

const ROLES = [
  { id: "admin", label: "HR Admin", note: "Full Access", email: "admin@workforce.local", icon: Building2 },
  { id: "manager", label: "HR Manager", note: "Team Management", email: "user@workforce.local", icon: Users },
  { id: "employee", label: "Employee", note: "Self Service", email: "demo@workforce.local", icon: User },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

const readRemembered = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
};

const FEATURES = [
  { icon: ChartColumn, title: "Predict", note: "Attrition Risk", tone: "#4f46e5", bg: "#eef0ff" },
  { icon: GraduationCap, title: "Identify", note: "Skill Gaps", tone: "#059669", bg: "#e5f7ef" },
  { icon: Users, title: "Empower", note: "Your Talent", tone: "#d97706", bg: "#fdf1e0" },
  { icon: Target, title: "Drive", note: "Higher Retention", tone: "#dc2626", bg: "#fdeaea" },
];

const SAMPLE_ROWS = [
  {
    name: "Deborah Jackson",
    role: "Product Manager",
    risk: "High",
    dot: "var(--risk-high)",
    tag: "Action required",
    tagTone: "#c81e1e",
    tagBg: "#fde8e8",
  },
  {
    name: "James Wilson",
    role: "Enterprise Sales",
    risk: "Medium",
    dot: "var(--risk-medium)",
    tag: "Monitor",
    tagTone: "#b45309",
    tagBg: "#fdf0dc",
  },
  {
    name: "Linda Anderson",
    role: "HR Business Partner",
    risk: "Low",
    dot: "var(--risk-low)",
    tag: "On track",
    tagTone: "#0b7a4b",
    tagBg: "#e0f5ea",
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("");

/** Illustrative product preview. Sample figures only; nothing here reads from the API. */
const HeroPreview: React.FC = () => (
  <div className="relative mx-auto mt-4 h-[340px] w-full max-w-[720px] select-none" aria-hidden="true">
    {/* soft stage */}
    <div
      className="absolute inset-x-6 bottom-0 top-8 rounded-[28px]"
      style={{
        background: "linear-gradient(160deg, rgb(255 255 255 / 0.85), rgb(240 238 255 / 0.7))",
        boxShadow: "0 30px 60px -24px rgb(79 70 229 / 0.28), inset 0 1px 0 #fff",
        border: "1px solid rgb(79 70 229 / 0.08)",
      }}
    />

    {/* At risk of leaving */}
    <div
      className="absolute left-16 top-0 w-[400px] rounded-2xl bg-white p-5"
      style={{ boxShadow: "0 18px 40px -16px rgb(30 27 75 / 0.25), 0 2px 6px rgb(30 27 75 / 0.06)" }}
    >
      <p className="text-[13px] font-semibold text-slate-800">At risk of leaving</p>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="text-[34px] font-bold leading-none text-slate-900">10</span>
            <span className="text-lg text-slate-500">/ 50</span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
              ↑ 20%
            </span>
          </p>
          <p className="mt-1.5 text-[11.5px] text-slate-500">Employees at high or critical risk</p>
        </div>
        <div className="flex h-14 items-end gap-2">
          {[10, 18, 26, 38, 30, 46].map((h, i) => (
            <span
              key={i}
              className="w-3.5 rounded-t"
              style={{
                height: h,
                background: i === 0 ? "#f9a8a8" : `rgb(129 120 245 / ${0.35 + i * 0.1})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>

    {/* Skill alignment */}
    <div
      className="absolute right-2 top-[-6px] w-[190px] rotate-[3deg] rounded-2xl bg-white p-4"
      style={{ boxShadow: "0 18px 40px -16px rgb(30 27 75 / 0.25), 0 2px 6px rgb(30 27 75 / 0.06)" }}
    >
      <p className="text-[11.5px] font-semibold text-slate-700">Skill alignment</p>
      <div className="mt-2 flex items-center gap-3">
        <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
          <circle cx="24" cy="24" r="19" fill="none" stroke="#dff3e8" strokeWidth="6" />
          <circle
            cx="24"
            cy="24"
            r="19"
            fill="none"
            stroke="#10b981"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${0.94 * 2 * Math.PI * 19} ${2 * Math.PI * 19}`}
          />
        </svg>
        <div>
          <p className="text-[22px] font-bold leading-none text-slate-900">94%</p>
          <p className="mt-1 text-[10px] text-slate-500">Target: 90%</p>
        </div>
      </div>
    </div>

    {/* Critical skill gaps */}
    <div
      className="absolute bottom-[112px] left-0 w-[150px] -rotate-[3deg] rounded-2xl bg-white p-3.5"
      style={{ boxShadow: "0 18px 40px -16px rgb(30 27 75 / 0.25), 0 2px 6px rgb(30 27 75 / 0.06)" }}
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <Users className="h-3.5 w-3.5" />
        </span>
        Critical skill gaps
      </p>
      <p className="mt-1.5 text-[26px] font-bold leading-none text-slate-900">5</p>
      <p className="mt-1 text-[10px] text-slate-500">Roles affected</p>
    </div>

    {/* People table */}
    <div
      className="absolute bottom-3 left-[172px] right-6 rounded-2xl bg-white px-5 py-3"
      style={{ boxShadow: "0 18px 40px -16px rgb(30 27 75 / 0.22), 0 2px 6px rgb(30 27 75 / 0.05)" }}
    >
      {SAMPLE_ROWS.map((r) => (
        <div key={r.name} className="flex items-center gap-3 py-2 text-[12px]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
            {initials(r.name)}
          </span>
          <span className="w-[130px] min-w-0">
            <span className="block truncate font-semibold text-slate-800">{r.name}</span>
            <span className="block truncate text-[10.5px] text-slate-500">{r.role}</span>
          </span>
          <span className="flex w-[80px] items-center gap-1.5 font-medium text-slate-700">
            <span className="h-2 w-2 rounded-full" style={{ background: r.dot }} />
            {r.risk}
          </span>
          <span
            className="ml-auto rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
            style={{ color: r.tagTone, background: r.tagBg }}
          >
            {r.tag}
          </span>
        </div>
      ))}
    </div>

    {/* Training completion */}
    <div
      className="absolute bottom-[-6px] left-[-14px] w-[190px] -rotate-[4deg] rounded-2xl bg-white p-3.5"
      style={{ boxShadow: "0 18px 40px -16px rgb(30 27 75 / 0.25), 0 2px 6px rgb(30 27 75 / 0.06)" }}
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
          <UserRound className="h-3.5 w-3.5" />
        </span>
        Training completion
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[26px] font-bold leading-none text-slate-900">68%</span>
        <TrendingUp className="h-5 w-5 text-emerald-500" />
      </div>
      <p className="mt-1 text-[10px] text-emerald-600">↑ 12% vs last month</p>
    </div>
  </div>
);

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const remembered = readRemembered();
  const [email, setEmail] = useState(remembered);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [role, setRole] = useState<RoleId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const pickRole = (id: RoleId) => {
    const r = ROLES.find((x) => x.id === id)!;
    setRole(id);
    setEmail(r.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setInfo(`${r.label} demo account selected. Press Sign In to continue.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* storage can be blocked; signing in still works */
      }
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err, "Authentication failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  // Already signed in (e.g. opened /login in a new tab): go straight to the app
  if (user) return <Navigate to="/" replace />;

  const showInfo = (text: string) => {
    setError(null);
    setInfo(text);
  };

  return (
    <div
      className="relative flex min-h-screen w-full overflow-hidden text-slate-800 antialiased"
      style={{ background: "linear-gradient(135deg, #fbfbff 0%, #f4f3ff 45%, #f8f9ff 100%)" }}
    >
      {/* Left: story */}
      <section className="relative hidden flex-1 flex-col px-14 py-10 lg:flex xl:px-20">
        {/* background glow */}
        <div
          className="pointer-events-none absolute -right-24 top-24 h-[520px] w-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgb(129 120 245 / 0.22), transparent 65%)" }}
        />
        <svg className="pointer-events-none absolute right-6 top-[210px] w-[240px]" viewBox="0 0 300 120" fill="none">
          <path d="M0 110 C90 100 160 70 285 22" stroke="#8b83f5" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <circle cx="285" cy="22" r="5" fill="#6d5ff0" />
        </svg>

        <div className="relative z-10 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[22px] font-extrabold text-white"
            style={{
              background: "linear-gradient(145deg, #5b5cf0, #4338ca)",
              boxShadow: "0 8px 18px -6px rgb(67 56 202 / 0.6)",
            }}
          >
            W
          </div>
          <div className="leading-tight">
            <p className="text-[19px] font-bold tracking-tight text-slate-900">WorkforceAI</p>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Predictive Platform
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-10 max-w-[620px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-indigo-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> AI-Powered Workforce Intelligence
          </span>
          <h1 className="mt-5 text-[46px] font-extrabold leading-[1.1] tracking-tight text-slate-900 xl:text-[52px]">
            Predict Attrition,
            <br />
            Bridge Skill Gaps &amp;
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #4f46e5, #9333ea)" }}
            >
              Empower Talent.
            </span>
          </h1>
          <p className="mt-4 max-w-[500px] text-[15px] leading-relaxed text-slate-600">
            Leverage machine learning, automated skill gap diagnostics, and targeted retention recommendations in one
            unified platform.
          </p>

          <ul className="mt-6 flex flex-nowrap gap-x-5">
            {FEATURES.map(({ icon: Icon, title, note, tone, bg }) => (
              <li key={title} className="flex items-center gap-2.5">
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: bg, color: tone }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="whitespace-nowrap leading-tight">
                  <span className="block text-[13.5px] font-semibold text-slate-900">{title}</span>
                  <span className="block text-xs text-slate-500">{note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 mt-6 flex-1">
          <HeroPreview />
        </div>

        <ul className="relative z-10 mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px] text-slate-600">
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Enterprise-grade security
          </li>
          <li className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-500" /> JWT authentication
          </li>
          <li className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" /> Complete audit trails
          </li>
        </ul>
      </section>

      {/* Right: sign in */}
      <section className="relative flex w-full flex-col border-l border-white/60 bg-white/55 px-6 py-8 backdrop-blur-sm sm:px-12 lg:w-[46%] lg:max-w-[720px] lg:px-16">
        <div className="flex justify-between lg:justify-end">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-extrabold text-white"
              style={{ background: "linear-gradient(145deg, #5b5cf0, #4338ca)" }}
            >
              W
            </span>
            <span className="text-base font-bold text-slate-900">WorkforceAI</span>
          </div>
          <button
            type="button"
            onClick={() => showInfo("Need a hand? Contact your HR administrator to get an account or reset access.")}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900"
          >
            <CircleHelp className="h-4 w-4" /> Need help?
          </button>
        </div>

        <div className="flex flex-1 items-center py-8">
          <div
            className="mx-auto w-full max-w-[540px] rounded-2xl border border-white bg-white p-8 sm:p-9"
            style={{ boxShadow: "0 30px 70px -30px rgb(67 56 202 / 0.25), 0 4px 14px rgb(30 27 75 / 0.06)" }}
          >
            <h2 className="text-[27px] font-bold tracking-tight text-slate-900">
              Welcome to{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, #4f46e5, #6d5ff0)" }}
              >
                WorkforceAI
              </span>
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to access your workforce analytics platform.</p>

            <div className="mt-6 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Demo role">
              {ROLES.map(({ id, label, note, icon: Icon }) => {
                const on = role === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickRole(id)}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-3 text-left transition-all ${
                      on
                        ? "border-indigo-300 bg-indigo-50/70 shadow-[0_0_0_3px_rgb(99_102_241/0.12)]"
                        : "border-slate-200 bg-slate-50/60 hover:border-indigo-200 hover:bg-white"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${on ? "text-indigo-600" : "text-slate-500"}`} />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-[13px] font-semibold text-slate-900">{label}</span>
                      <span className="block whitespace-nowrap text-[10px] text-slate-500">{note}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
            {info && !error && (
              <div
                role="status"
                className="mt-5 flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3.5 text-[13px] text-indigo-800"
              >
                <Info className="h-4 w-4 flex-shrink-0" />
                <p>{info}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-[13.5px] font-semibold text-slate-900">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    type="text"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setRole(null);
                    }}
                    placeholder="admin@workforce.local"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-[13.5px] font-semibold text-slate-900">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() =>
                    showInfo("Password resets are handled by your HR administrator. Ask them to reset your account.")
                  }
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{
                  background: "linear-gradient(180deg, #5148ee, #4338ca)",
                  boxShadow: "0 12px 24px -10px rgb(67 56 202 / 0.65), inset 0 1px 0 rgb(255 255 255 / 0.18)",
                }}
              >
                {loading ? (
                  "Signing in..."
                ) : (
                  <>
                    Sign In to Platform <ArrowRight className="h-[18px] w-[18px]" />
                  </>
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-4 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() =>
                showInfo("Single sign-on isn't configured for this workspace. Sign in with your corporate email.")
              }
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-[14.5px] font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
                />
              </svg>
              Continue with Google (SSO)
            </button>

            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Your data is secure and encrypted
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
