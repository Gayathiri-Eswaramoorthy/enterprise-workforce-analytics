import React, { useState, useEffect, useCallback } from "react";
import api, { getErrorMessage } from "../services/api";
import type { Recommendation, RecommendationStatus } from "../types";
import { Check, X, CheckCircle, ArrowRight, RefreshCw, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_FILTERS: { value: RecommendationStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

const STATUS_STYLE: Record<RecommendationStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-100",
  ACCEPTED: "bg-indigo-50 text-indigo-700 border-indigo-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  REJECTED: "bg-slate-50 text-slate-500 border-slate-200",
};

const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

export const RecommendationsPage: React.FC = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | "ALL">("PENDING");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page_size: 100 };
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res = await api.get("/recommendations", { params });
      const items: Recommendation[] = res.data.items;
      // Most urgent first
      items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
      setRecommendations(items);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  const handleGenerateAll = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const res = await api.post("/recommendations/generate-all");
      const created: number = res.data.created;
      setNotice(
        created > 0
          ? `Generated ${created} new recommendation${created === 1 ? "" : "s"}.`
          : "Everything is up to date - no new recommendations needed."
      );
      await fetchRecs();
    } catch (err) {
      setNotice(getErrorMessage(err, "Failed to generate recommendations."));
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (recId: string, newStatus: RecommendationStatus) => {
    try {
      await api.patch(`/recommendations/${recId}/status`, { status: newStatus });
      // Drop it from a filtered view it no longer belongs to
      setRecommendations((prev) =>
        statusFilter === "ALL"
          ? prev.map((r) => (r.id === recId ? { ...r, status: newStatus } : r))
          : prev.filter((r) => r.id !== recId)
      );
      if (statusFilter !== "ALL") setTotal((t) => t - 1);
    } catch (err) {
      alert(getErrorMessage(err, "Failed to update recommendation status."));
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                statusFilter === f.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
              {statusFilter === f.value && !loading && ` (${total})`}
            </button>
          ))}
        </div>
        <button
          onClick={handleGenerateAll}
          disabled={generating}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Analyzing workforce..." : "Generate for workforce"}
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">{notice}</div>
      )}

      {/* Recommendations Cards List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Lightbulb className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-slate-700">
            No {statusFilter === "ALL" ? "" : `${statusFilter.toLowerCase()} `}recommendations.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Recommendations are derived from skill gaps and the latest attrition-risk predictions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recommendations.map((rec) => (
            <div key={rec.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                      {rec.recommendation_type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        rec.priority === "CRITICAL" || rec.priority === "HIGH"
                          ? "bg-rose-50 text-rose-700 border border-rose-100"
                          : "bg-amber-50 text-amber-700 border border-amber-100"
                      }`}
                    >
                      {rec.priority} PRIORITY
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${STATUS_STYLE[rec.status]}`}>
                    {rec.status}
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-500">
                  {rec.employee_name ?? "Employee"}
                  {rec.employee_code && ` · ${rec.employee_code}`}
                  {rec.job_role_title && ` · ${rec.job_role_title}`}
                </p>
                <h4 className="mt-1 text-base font-bold text-slate-900">{rec.title}</h4>
                <p className="text-xs text-slate-600 mt-1">{rec.description}</p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
                <Link
                  to={`/employees/${rec.employee_id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  View Profile <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <div className="flex items-center gap-2">
                  {rec.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(rec.id, "ACCEPTED")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100/80 border border-emerald-100 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(rec.id, "REJECTED")}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/80 border border-rose-100 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </>
                  )}
                  {rec.status === "ACCEPTED" && (
                    <button
                      onClick={() => handleUpdateStatus(rec.id, "COMPLETED")}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100/80 border border-indigo-100 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Mark done
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
