import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Recommendation } from "../types";
import { Check, X, CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export const RecommendationsPage: React.FC = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/recommendations");
      setRecommendations(res.data.items);
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecs();
  }, []);

  const handleUpdateStatus = async (recId: string, newStatus: string) => {
    try {
      await api.patch(`/recommendations/${recId}/status`, { status: newStatus });
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, status: newStatus as any } : r))
      );
    } catch (err: any) {
      alert("Failed to update recommendation status.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Recommendations Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : recommendations.length === 0 ? (
          <p className="col-span-2 text-center text-sm text-slate-400 py-12">
            No retention or training recommendations found.
          </p>
        ) : (
          recommendations.map((rec) => (
            <div key={rec.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-slate-350 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
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

                  <span className="text-xs text-slate-500 font-semibold">Status: {rec.status}</span>
                </div>

                <h4 className="text-base font-bold text-slate-900">{rec.title}</h4>
                <p className="text-xs text-slate-600 mt-1">{rec.description}</p>
                {rec.action_plan && (
                  <div className="mt-3.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    <strong className="text-indigo-700 block mb-1">Recommended Action Plan</strong>
                    {rec.action_plan}
                  </div>
                )}
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
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-100 transition-colors"
                        title="Accept Recommendation"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(rec.id, "REJECTED")}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100/80 border border-rose-100 transition-colors"
                        title="Reject Recommendation"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {rec.status === "ACCEPTED" && (
                    <button
                      onClick={() => handleUpdateStatus(rec.id, "COMPLETED")}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 border border-indigo-100 transition-colors"
                      title="Mark Completed"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
