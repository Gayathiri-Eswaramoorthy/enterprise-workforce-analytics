import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { AuditLog } from "../types";

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const params: any = { page: 1, page_size: 50 };
        if (entityFilter) params.entity_name = entityFilter;
        if (actionFilter) params.action = actionFilter;

        const res = await api.get("/audit-logs", { params });
        setLogs(res.data.items);
      } catch (err) {
        console.error("Failed to load audit logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [entityFilter, actionFilter]);

  return (
    <div className="space-y-6">
      {/* Search and filter bar */}
      <div className="flex gap-4">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-[#0F1524] px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
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
          className="rounded-xl border border-slate-800 bg-[#0F1524] px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
        >
          <option value="">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="PREDICT">PREDICT</option>
          <option value="BATCH_PREDICT">BATCH_PREDICT</option>
          <option value="GENERATE_RECOMMENDATIONS">GENERATE_RECOMMENDATIONS</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0F1524] overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-[#0B0F19]/60 text-xs uppercase font-semibold text-slate-400 tracking-wider">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">Entity</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  No system audit logs found matching criteria.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-200 block">{log.user?.display_name || log.user?.username || "System"}</span>
                    <span className="text-[10px] text-slate-500">{log.user?.email || "System-wide"}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-indigo-400">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {log.entity_name}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {log.description}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
