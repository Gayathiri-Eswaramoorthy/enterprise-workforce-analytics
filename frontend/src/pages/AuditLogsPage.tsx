import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../services/api";
import type { AuditLog } from "../types";
import { Download, FileSpreadsheet, FileText, ScrollText, Search, ShieldCheck, UserCheck, RefreshCw } from "lucide-react";
import { exportComplianceAuditLogs, type AuditLogExportItem } from "../utils/exportReports";

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: 1, page_size: 100 };
      if (entityFilter) params.entity_name = entityFilter;
      if (actionFilter) params.action = actionFilter;

      const res = await api.get("/audit-logs", { params });
      setLogs(res.data.items);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter by search query in memory
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        l.description?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.entity_name?.toLowerCase().includes(q) ||
        l.user?.display_name?.toLowerCase().includes(q) ||
        l.user?.email?.toLowerCase().includes(q),
    );
  }, [logs, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    const mutations = logs.filter((l) => ["CREATE", "UPDATE", "DELETE"].includes(l.action)).length;
    const uniqueActors = new Set(logs.map((l) => l.user?.email).filter(Boolean)).size;
    return { total, mutations, uniqueActors };
  }, [logs]);

  const handleExport = (format: "csv" | "pdf") => {
    setShowExportMenu(false);
    const exportItems: AuditLogExportItem[] = filteredLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entity_name: l.entity_name,
      description: l.description || "—",
      timestamp: l.created_at,
      user: l.user,
    }));
    exportComplianceAuditLogs(format, exportItems);
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Export Dropdown */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-ink">Compliance & Audit Log</h1>
          <p className="text-[13.5px] text-ink-2 mt-0.5">
            Immutable system audit trail of all administrative updates, role assignments, and predictive runs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="rounded-lg border border-rule bg-panel px-3.5 py-2 text-[13px] font-medium text-ink hover:bg-sunken transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-accent" : "text-ink-3"}`} />
            Refresh
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span>Export Audit Trail</span>
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl border border-rule bg-panel py-1.5 shadow-xl animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                    Export Format
                  </div>
                  <button
                    onClick={() => handleExport("csv")}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink hover:bg-sunken transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span>Download CSV Spreadsheet</span>
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink hover:bg-sunken transition-colors"
                  >
                    <FileText className="h-4 w-4 text-rose-600" />
                    <span>Formatted Executive PDF</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-raised flex items-center justify-between p-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">Recorded Operations</div>
            <div className="text-[24px] font-bold text-ink mt-0.5">{metrics.total}</div>
            <div className="text-[11px] text-ink-3">Total events in current audit window</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-link">
            <ScrollText className="h-5 w-5" />
          </div>
        </div>

        <div className="card-raised flex items-center justify-between p-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">State Mutations</div>
            <div className="text-[24px] font-bold text-ink mt-0.5">{metrics.mutations}</div>
            <div className="text-[11px] text-ink-3">Create, update, or deletion actions</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="card-raised flex items-center justify-between p-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">Active Operators</div>
            <div className="text-[24px] font-bold text-ink mt-0.5">{metrics.uniqueActors}</div>
            <div className="text-[11px] text-ink-3">Authorized users recording actions</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card-raised flex flex-wrap items-center gap-3 p-3.5">
        <div className="relative min-w-[220px] flex-1 max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-3" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, description, or user..."
            className="field pl-9 text-[13px]"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="field w-auto text-[13px]"
        >
          <option value="">All Entities</option>
          <option value="Employee">Employee</option>
          <option value="Department">Department</option>
          <option value="JobRole">JobRole</option>
          <option value="User">User</option>
          <option value="PredictionHistory">PredictionHistory</option>
          <option value="Recommendation">Recommendation</option>
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="field w-auto text-[13px]"
        >
          <option value="">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="PREDICT">PREDICT</option>
          <option value="BATCH_PREDICT">BATCH_PREDICT</option>
          <option value="GENERATE_RECOMMENDATIONS">GENERATE_RECOMMENDATIONS</option>
          <option value="ENROLL">ENROLL</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px] text-ink">
            <thead className="border-b border-rule bg-sunken text-[11.5px] uppercase font-semibold text-ink-2 tracking-wider">
              <tr>
                <th className="px-5 py-3">Actor / User</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-soft">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-ink-3">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    <div className="mt-2 text-[12.5px]">Loading audit ledger...</div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-ink-3">
                    No compliance audit logs found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let actionBadge = "bg-slate-100 text-slate-700";
                  if (log.action === "DELETE") actionBadge = "bg-rose-50 text-rose-700 border border-rose-200";
                  else if (log.action === "CREATE") actionBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                  else if (log.action === "UPDATE") actionBadge = "bg-amber-50 text-amber-700 border border-amber-200";
                  else if (log.action.includes("PREDICT")) actionBadge = "bg-indigo-50 text-indigo-700 border border-indigo-200";

                  return (
                    <tr key={log.id} className="hover:bg-hover transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-ink block leading-tight">
                          {log.user?.display_name || log.user?.username || "System Automated"}
                        </span>
                        <span className="text-[11px] text-ink-3">{log.user?.email || "internal@workforce.local"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${actionBadge}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-ink">
                        {log.entity_name}
                      </td>
                      <td className="px-5 py-3.5 text-ink-2 max-w-[340px]">
                        {log.description}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-ink-3 font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
