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
      {/* Top Banner / Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">System Overview</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Operational
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-3">
            System governance, administrative security, user account provisioning, and audit logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-panel px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-sm hover:bg-sunken hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/users"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Manage Users & Roles
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">User Accounts</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{data.total_users}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              {data.active_users} active
            </span>
            {data.inactive_users > 0 && <span>{data.inactive_users} inactive</span>}
          </div>
        </div>

        {/* Managed Workforce */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Employee Records</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{data.total_employees}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span className="text-emerald-600 font-medium">{data.active_employees} active roster</span>
            <Link to="/employees" className="text-accent hover:underline flex items-center gap-0.5">
              Directory <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>

        {/* Organization Structure */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Departments & Roles</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {data.total_departments} <span className="text-sm font-normal text-ink-3">/ {data.total_job_roles} roles</span>
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Organizational units</span>
            <Link to="/departments" className="text-accent hover:underline flex items-center gap-0.5">
              Configure <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>

        {/* Audit Log Volume */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Audit Log Events</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ScrollText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{data.total_audit_logs}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Security audit trail</span>
            <Link to="/audit-logs" className="text-accent hover:underline flex items-center gap-0.5">
              Inspect <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Grid: User Accounts Governance & Platform Infrastructure */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols): User Accounts by Role & Quick Administration */}
        <div className="space-y-6 lg:col-span-2">
          {/* User Role Provisioning Card */}
          <div className="rounded-xl border border-rule bg-panel p-5 shadow-card">
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

            {/* Quick Action Buttons Bar */}
            <div className="mt-5 border-t border-rule pt-4 flex flex-wrap gap-2.5">
              <Link
                to="/users"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-sunken px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover hover:border-rule-strong"
              >
                <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                Add User Account
              </Link>
              <Link
                to="/employees"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-sunken px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover hover:border-rule-strong"
              >
                <Users className="h-3.5 w-3.5 text-blue-600" />
                Employee Records
              </Link>
              <Link
                to="/departments"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-sunken px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover hover:border-rule-strong"
              >
                <Building2 className="h-3.5 w-3.5 text-cyan-600" />
                Manage Departments
              </Link>
              <Link
                to="/audit-logs"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-sunken px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover hover:border-rule-strong"
              >
                <ScrollText className="h-3.5 w-3.5 text-amber-600" />
                Full Audit Trail
              </Link>
            </div>
          </div>

          {/* Recent Audit Activity Table */}
          <div className="rounded-xl border border-rule bg-panel p-5 shadow-card">
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

            {data.recent_audit_logs.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink-3">No audit activity recorded yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rule text-ink-3">
                      <th className="pb-2 font-medium">Action</th>
                      <th className="pb-2 font-medium">Entity</th>
                      <th className="pb-2 font-medium">Initiator</th>
                      <th className="pb-2 font-medium">Details</th>
                      <th className="pb-2 text-right font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-soft">
                    {data.recent_audit_logs.map((log) => {
                      const isCreate = log.action.includes("CREATE");
                      const isDelete = log.action.includes("DELETE");
                      const isUpdate = log.action.includes("UPDATE");
                      return (
                        <tr key={log.id} className="hover:bg-hover/50">
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
        </div>

        {/* Right Column (1 col): System Governance & Infrastructure */}
        <div className="space-y-6">
          {/* Platform Governance Card */}
          <div className="rounded-xl border border-rule bg-panel p-5 shadow-card">
            <h2 className="text-base font-semibold text-ink">Platform Governance</h2>
            <p className="mt-0.5 text-xs text-ink-3">Infrastructure state and security standards.</p>

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

          {/* Audit Action Distribution */}
          {data.audit_action_counts.length > 0 && (
            <div className="rounded-xl border border-rule bg-panel p-5 shadow-card">
              <h2 className="text-sm font-semibold text-ink">Audit Operations by Type</h2>
              <div className="mt-3 space-y-2">
                {data.audit_action_counts.map((item) => (
                  <div key={item.action} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-2 truncate" title={item.action}>
                      {item.action}
                    </span>
                    <span className="rounded bg-sunken px-2 py-0.5 font-semibold text-ink">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
