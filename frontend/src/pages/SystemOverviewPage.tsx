import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  Lock,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AnimatedCounter } from "../components/AnimatedCounter";

const AUDIT_COLORS = [
  "#4f46e5", // Indigo
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f43f5e", // Rose
];

interface AuditActionCount {
  action: string;
  count: number;
}

interface RecentAuditActivity {
  id: string;
  user_email: string | null;
  action: string;
  entity_name: string;
  description: string;
  ip_address: string | null;
  created_at: string;
}

interface SystemOverviewData {
  total_users: number;
  active_users: number;
  inactive_users: number;
  users_by_role: Record<string, number>;
  total_employees: number;
  active_employees: number;
  total_departments: number;
  total_job_roles: number;
  total_audit_logs: number;
  recent_audit_logs: RecentAuditActivity[];
  audit_action_counts: AuditActionCount[];
  active_model_version: string | null;
  system_status: string;
}

export const SystemOverviewPage: React.FC = () => {
  const [data, setData] = useState<SystemOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditGhostLoading, setAuditGhostLoading] = useState(true);

  const fetchOverview = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.get<SystemOverviewData>("/dashboard/admin-overview");
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load system administration overview."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    // 2 seconds ghost loading as requested
    const ghostTimer = setTimeout(() => {
      setAuditGhostLoading(false);
    }, 2000);
    return () => clearTimeout(ghostTimer);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[450px] w-full items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-medium text-ink-3">Loading system administration metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
        <p className="font-medium">{error || "Failed to load system metrics."}</p>
        <button
          onClick={() => fetchOverview(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const roleCounts = data.users_by_role || {};
  const adminCount = roleCounts["HR_ADMIN"] || 0;
  const managerCount = roleCounts["HR_MANAGER"] || 0;
  const employeeCount = roleCounts["EMPLOYEE"] || 0;

  return (
    <div className="space-y-6">

      {/* ── BANNER FIRST: Wallpaper + 4 KPI cards ── */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 p-6 shadow-xl">
        {/* Wallpaper background image */}
        <img
          src="/banner-wallpaper.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Luminous overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/65 via-indigo-950/50 to-slate-950/70 backdrop-blur-[1px]" />
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />

        {/* Banner heading */}
        <div className="relative z-10 mb-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
            Enterprise System Administration
          </span>
          <p className="mt-2 text-xs sm:text-sm text-white/85 max-w-xl mx-auto font-normal">
            System governance, administrative security, user account provisioning, and live audit telemetry.
          </p>
        </div>

        {/* 4 KPI Cards */}
        <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Users */}
          <div className="rounded-xl border border-white/60 bg-white/95 backdrop-blur-md p-4 shadow-lg transition-all hover:bg-white hover:border-indigo-300 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">User Accounts</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              <AnimatedCounter value={data.total_users} duration={900} />
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                <AnimatedCounter value={data.active_users} duration={900} /> active
              </span>
              {data.inactive_users > 0 && <span>{data.inactive_users} inactive</span>}
            </div>
          </div>

          {/* Managed Workforce */}
          <div className="rounded-xl border border-white/60 bg-white/95 backdrop-blur-md p-4 shadow-lg transition-all hover:bg-white hover:border-blue-300 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Employee Records</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              <AnimatedCounter value={data.total_employees} duration={1100} />
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="text-emerald-600 font-semibold">
                <AnimatedCounter value={data.active_employees} duration={1100} /> active roster
              </span>
              <Link to="/employees" className="text-indigo-600 font-semibold hover:underline flex items-center gap-0.5">
                Directory <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>

          {/* Organization Structure */}
          <div className="rounded-xl border border-white/60 bg-white/95 backdrop-blur-md p-4 shadow-lg transition-all hover:bg-white hover:border-cyan-300 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Departments & Roles</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              <AnimatedCounter value={data.total_departments} duration={800} />{" "}
              <span className="text-sm font-normal text-slate-500">/ {data.total_job_roles} roles</span>
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Organizational units</span>
              <Link to="/departments" className="text-indigo-600 font-semibold hover:underline flex items-center gap-0.5">
                Configure <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>

          {/* Audit Log Volume */}
          <div className="rounded-xl border border-white/60 bg-white/95 backdrop-blur-md p-4 shadow-lg transition-all hover:bg-white hover:border-amber-300 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit Log Events</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <ScrollText className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              <AnimatedCounter value={data.total_audit_logs} duration={1000} />
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Security audit trail</span>
              <Link to="/audit-logs" className="text-indigo-600 font-semibold hover:underline flex items-center gap-0.5">
                Inspect <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── TITLE ROW BELOW BANNER: System Overview heading + Operational + Refresh inline ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">System Overview</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Operational
              </span>
              {/* Refresh button right next to Operational badge */}
              <button
                onClick={() => fetchOverview(true)}
                disabled={refreshing}
                title="Refresh system metrics"
                className="inline-flex items-center gap-1 rounded-lg border border-rule bg-panel px-2.5 py-1 text-xs font-semibold text-ink-2 shadow-sm hover:bg-sunken hover:text-ink disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-3">
              System governance, administrative security, user account provisioning, and audit logs.
            </p>
          </div>
        </div>
        <Link
          to="/users"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Manage Users & Roles
        </Link>
      </div>

      {/* Main Grid: User Accounts Governance & Platform Infrastructure */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-stretch">
        {/* Row 1 Left (2 cols): User Role Provisioning Card */}
        <div className="flex flex-col justify-between rounded-xl border border-rule bg-panel p-5 shadow-card lg:col-span-2">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Role Provisioning & Permissions</h2>
                <p className="text-xs text-ink-3">
                  Enterprise role breakdown and separation of administrative privileges.
                </p>
              </div>
              <Link
                to="/users"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                Manage Accounts <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* HR Admin Role */}
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    HR_ADMIN
                  </span>
                  <span className="text-lg font-bold text-indigo-900">{adminCount}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-ink">System Administrator</p>
                <p className="mt-1 text-[11px] text-ink-3 leading-relaxed">
                  Full governance: User account creation, role assignments, department setup, audit log inspection.
                </p>
              </div>

              {/* HR Manager Role */}
              <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                    HR_MANAGER
                  </span>
                  <span className="text-lg font-bold text-cyan-900">{managerCount}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-ink">Workforce Decision Maker</p>
                <p className="mt-1 text-[11px] text-ink-3 leading-relaxed">
                  Analytics & retention: Attrition risk scoring, priority actions, skill gaps, learning analytics.
                </p>
              </div>

              {/* Employee Role */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    EMPLOYEE
                  </span>
                  <span className="text-lg font-bold text-slate-900">{employeeCount}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-ink">Self-Service User</p>
                <p className="mt-1 text-[11px] text-ink-3 leading-relaxed">
                  Personal development: Voluntary course enrollment, skill assessments, career discussion requests.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons Bar */}
          <div className="mt-5 border-t border-rule pt-4 flex flex-wrap gap-2.5">
            <Link
              to="/users"
              className="inline-flex items-center gap-2 rounded-lg border border-rule-strong bg-panel px-3.5 py-2 text-xs font-semibold text-ink shadow-xs hover:shadow-sm hover:border-accent hover:bg-accent/5 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600">
                <UserCheck className="h-3.5 w-3.5" />
              </span>
              Add User Account
            </Link>
            <Link
              to="/employees"
              className="inline-flex items-center gap-2 rounded-lg border border-rule-strong bg-panel px-3.5 py-2 text-xs font-semibold text-ink shadow-xs hover:shadow-sm hover:border-blue-500/50 hover:bg-blue-500/5 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
                <Users className="h-3.5 w-3.5" />
              </span>
              Employee Records
            </Link>
            <Link
              to="/departments"
              className="inline-flex items-center gap-2 rounded-lg border border-rule-strong bg-panel px-3.5 py-2 text-xs font-semibold text-ink shadow-xs hover:shadow-sm hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                <Building2 className="h-3.5 w-3.5" />
              </span>
              Manage Departments
            </Link>
            <Link
              to="/audit-logs"
              className="inline-flex items-center gap-2 rounded-lg border border-rule-strong bg-panel px-3.5 py-2 text-xs font-semibold text-ink shadow-xs hover:shadow-sm hover:border-amber-500/50 hover:bg-amber-500/5 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                <ScrollText className="h-3.5 w-3.5" />
              </span>
              Full Audit Trail
            </Link>
          </div>
        </div>

        {/* Row 1 Right (1 col): Platform Governance Card */}
        <div className="flex flex-col justify-between rounded-xl border border-rule bg-panel p-5 shadow-card lg:col-span-1">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Platform Governance</h2>
                <p className="text-xs text-ink-3">Infrastructure state and security standards.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Database */}
              <div className="flex items-start gap-3 rounded-lg border border-rule bg-sunken p-3">
                <Database className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink">PostgreSQL Database</p>
                    <span className="text-[10px] font-semibold text-emerald-600">CONNECTED</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    ACID transactional integrity, automated foreign keys, alembic version control.
                  </p>
                </div>
              </div>

              {/* Machine Learning Model */}
              <div className="flex items-start gap-3 rounded-lg border border-rule bg-sunken p-3">
                <Cpu className="h-5 w-5 text-cyan-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink">ML Inference Engine</p>
                    <span className="text-[10px] font-semibold text-accent">
                      {data.active_model_version || "v2.0.0-ibm"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    IBM HR Analytics calibrated Random Forest. 8-feature schema with SHAP/factor explanations.
                  </p>
                </div>
              </div>

              {/* Token Security */}
              <div className="flex items-start gap-3 rounded-lg border border-rule bg-sunken p-3">
                <Lock className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink">Token & Session Security</p>
                    <span className="text-[10px] font-semibold text-emerald-600">ENFORCED</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    JWT Access Tokens (30m) with real-time revoked token blacklist verification.
                  </p>
                </div>
              </div>

              {/* Role Isolation */}
              <div className="flex items-start gap-3 rounded-lg border border-rule bg-sunken p-3">
                <Activity className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink">Access Control Isolation</p>
                    <span className="text-[10px] font-semibold text-amber-700">3-TIER RBAC</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    HR Admin (Governance) &bull; HR Manager (Workforce) &bull; Employee (Self-Service).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2 Left (2 cols): Recent Audit Activity Table */}
        <div className="flex flex-col justify-between rounded-xl border border-rule bg-panel p-5 shadow-card lg:col-span-2">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Recent Audit Trail</h2>
                <p className="text-xs text-ink-3">Live immutable log of administrative and system operations.</p>
              </div>
              <Link
                to="/audit-logs"
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {auditGhostLoading ? (
              /* Ghost loading skeleton for 2 seconds */
              <div className="mt-3 space-y-3 py-2">
                <div className="flex items-center justify-between border-b border-rule pb-2 text-[11px] text-ink-3">
                  <div className="h-3 w-8 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-14 rounded bg-slate-200 animate-pulse" />
                </div>
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-rule-soft/50 last:border-b-0">
                    <div className="h-3 w-6 rounded bg-slate-200/80 animate-pulse" />
                    <div className="h-4.5 w-20 rounded-md bg-indigo-100/60 animate-pulse" />
                    <div className="h-3.5 w-24 rounded bg-slate-200/80 animate-pulse" />
                    <div className="h-3.5 w-32 rounded bg-slate-200/80 animate-pulse" />
                    <div className="h-3.5 w-48 rounded bg-slate-200/80 animate-pulse" />
                    <div className="h-3.5 w-16 rounded bg-slate-200/80 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : data.recent_audit_logs.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink-3">No audit activity recorded yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rule text-ink-3">
                      <th className="pb-2 font-medium w-14">S.No</th>
                      <th className="pb-2 font-medium">Action</th>
                      <th className="pb-2 font-medium">Entity</th>
                      <th className="pb-2 font-medium">Initiator</th>
                      <th className="pb-2 font-medium">Details</th>
                      <th className="pb-2 text-right font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-soft">
                    {data.recent_audit_logs.slice(0, 6).map((log, index) => {
                      const isCreate = log.action.includes("CREATE");
                      const isDelete = log.action.includes("DELETE");
                      const isUpdate = log.action.includes("UPDATE");
                      return (
                        <tr key={log.id} className="hover:bg-hover/50">
                          <td className="py-2.5 font-medium text-ink-3">{index + 1}</td>
                          <td className="py-2.5">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                isCreate
                                  ? "bg-emerald-50 text-emerald-700"
                                  : isDelete
                                  ? "bg-rose-50 text-rose-700"
                                  : isUpdate
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 font-medium text-ink">{log.entity_name}</td>
                          <td className="py-2.5 text-ink-2 max-w-[140px] truncate" title={log.user_email || "System"}>
                            {log.user_email || "System"}
                          </td>
                          <td className="py-2.5 text-ink-3 max-w-[220px] truncate" title={log.description}>
                            {log.description}
                          </td>
                          <td className="py-2.5 text-right text-ink-3 whitespace-nowrap">
                            {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card Footer */}
          <div className="mt-4 flex flex-wrap items-center justify-between border-t border-rule pt-3 text-xs text-ink-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live sync active &bull; Immutable event ledger</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Showing 6 of {data.total_audit_logs} operations</span>
              <Link
                to="/audit-logs"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                Inspect All Events &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Row 2 Right (1 col): Audit Action Distribution */}
        <div className="flex flex-col justify-between rounded-xl border border-rule bg-panel p-5 shadow-card lg:col-span-1">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Audit Operations by Type</h2>
                <p className="text-xs text-ink-3">Distribution across action categories.</p>
              </div>
            </div>

            {data.audit_action_counts.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink-3">No operations recorded yet.</p>
            ) : (() => {
              const totalOps = data.audit_action_counts.reduce((sum, item) => sum + item.count, 0);
              const pieData = data.audit_action_counts.slice(0, 6).map((item) => ({
                name: item.action,
                value: item.count,
                percentage: totalOps > 0 ? ((item.count / totalOps) * 100).toFixed(1) : "0",
              }));

              return (
                <div className="mt-4 flex flex-col">
                  {/* Donut Pie Chart */}
                  <div className="relative h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={46}
                          outerRadius={70}
                          paddingAngle={3}
                          stroke="var(--bg-panel, #ffffff)"
                          strokeWidth={2}
                        >
                          {pieData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={AUDIT_COLORS[index % AUDIT_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-rule bg-panel p-2.5 shadow-lg text-xs">
                                  <p className="font-semibold text-ink">{d.name}</p>
                                  <p className="mt-0.5 text-ink-2">
                                    <span className="font-bold text-accent">{d.value}</span> events ({d.percentage}%)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Center Stat */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold tracking-tight text-ink tabular-nums">
                        {totalOps}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                        Total
                      </span>
                    </div>
                  </div>

                  {/* Legend / Breakdown List */}
                  <div className="mt-3 space-y-1.5 border-t border-rule-soft pt-3">
                    {pieData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: AUDIT_COLORS[index % AUDIT_COLORS.length] }}
                          />
                          <span className="font-medium text-ink-2 truncate" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                          <span className="font-semibold text-ink">{item.value}</span>
                          <span className="text-[10.5px] text-ink-3">({item.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
