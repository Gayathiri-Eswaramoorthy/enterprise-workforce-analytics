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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : recommendations.length === 0 ? (
          <p className="col-span-2 text-center text-sm text-slate-500 py-12">
            No retention or training recommendations found.
          </p>
        ) : (
          recommendations.map((rec) => (
            <div key={rec.id} className="rounded-2xl border border-slate-800 bg-[#0F1524] p-6 shadow-sm flex flex-col justify-between hover:border-slate-700/80 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                      {rec.recommendation_type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.priority === "CRITICAL" || rec.priority === "HIGH"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {rec.priority} PRIORITY
                    </span>
                  </div>

                  <span className="text-xs text-slate-500">Status: {rec.status}</span>
                </div>

                <h4 className="text-base font-bold text-slate-100">{rec.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{rec.description}</p>
                {rec.action_plan && (
                  <div className="mt-3.5 p-3 rounded-xl bg-[#0B0F19] border border-slate-800 text-xs text-slate-300">
                    <strong className="text-indigo-400 block mb-1">Recommended Action Plan</strong>
                    {rec.action_plan}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-4 mt-6">
                <Link
                  to={`/employees/${rec.employee_id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  View Profile <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <div className="flex items-center gap-2">
                  {rec.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(rec.id, "ACCEPTED")}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="Accept Recommendation"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(rec.id, "REJECTED")}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                        title="Reject Recommendation"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {rec.status === "ACCEPTED" && (
                    <button
                      onClick={() => handleUpdateStatus(rec.id, "COMPLETED")}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
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
