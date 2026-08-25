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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none shadow-sm"
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none shadow-sm"
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
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">Entity</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No system audit logs found matching criteria.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-800 block">{log.user?.display_name || log.user?.username || "System"}</span>
                    <span className="text-[10px] text-slate-500">{log.user?.email || "System-wide"}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-indigo-600">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {log.entity_name}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {log.description}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
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
