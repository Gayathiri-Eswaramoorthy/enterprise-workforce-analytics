import React, { useState, useEffect, useCallback } from "react";
import api, { getErrorMessage } from "../services/api";
import type { ModelRegistryEntry, PredictionHistoryItem, PredictionResult, RiskLevel } from "../types";
import { Brain, Play, CheckCircle2, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { RiskBadge } from "../components/RiskBadge";

const PAGE_SIZE = 20;
const RISK_FILTERS: { value: RiskLevel | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export const PredictionsPage: React.FC = () => {
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "">("");
  const [models, setModels] = useState<ModelRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningBatch, setRunningBatch] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (riskFilter) params.risk_level = riskFilter;
      const res = await api.get("/predictions/history", { params });
      setHistory(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to load prediction history", err);
    } finally {
      setLoading(false);
    }
  }, [page, riskFilter]);

  const fetchModels = useCallback(async () => {
    try {
      const res = await api.get("/predictions/models");
      setModels(res.data);
    } catch (err) {
      console.error("Failed to load model registry", err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleRunBatchPrediction = async () => {
    setRunningBatch(true);
    setNotice(null);
    try {
      const res = await api.post("/predictions/predict-all");
      const results: PredictionResult[] = res.data;
      const flagged = results.filter((r) => r.risk_level === "HIGH" || r.risk_level === "CRITICAL").length;
      setNotice(`Scored ${results.length} employees - ${flagged} at high or critical attrition risk.`);
      setPage(1);
      await Promise.all([fetchHistory(), fetchModels()]);
    } catch (err) {
      setNotice(getErrorMessage(err, "Batch prediction failed."));
    } finally {
      setRunningBatch(false);
    }
  };

  const activeModel = models.find((m) => m.is_active) ?? null;
  const isFallback = activeModel?.model_version.includes("rule-based");

  return (
    <div className="space-y-6">
      {/* Model Registry Card & Batch Trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Workforce Risk & Attrition ML Model</h3>
                <p className="text-xs text-slate-500">
                  {activeModel ? activeModel.training_dataset : "Active production model in Model Registry"}
                </p>
              </div>
            </div>
            {activeModel && (
              <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Active · {activeModel.model_version}
              </span>
            )}
          </div>

          {activeModel ? (
            isFallback ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                No trained model artifact found - predictions use the rule-based fallback heuristic. Run
                <code className="mx-1 font-mono">python ml/training/train.py</code> to train the ML model.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mt-6">
                <Metric label="Algorithm" value={activeModel.algorithm} small />
                <Metric label="Accuracy" value={`${Number(activeModel.accuracy).toFixed(1)}%`} tone="text-emerald-600" />
                <Metric label="Precision" value={`${Number(activeModel.precision_score).toFixed(1)}%`} />
                <Metric label="Recall" value={`${Number(activeModel.recall_score).toFixed(1)}%`} />
                <Metric label="F1 Score" value={`${Number(activeModel.f1_score).toFixed(1)}%`} tone="text-indigo-600" />
              </div>
            )
          ) : (
            <p className="text-xs text-slate-400 mt-4">Loading model registry...</p>
          )}
          {activeModel && !isFallback && (
            <p className="mt-3 text-[11px] text-slate-400">Metrics measured on a held-out test set during training.</p>
          )}
        </div>

        {/* Batch Predictor Action Box */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Workforce Batch Inference</h3>
            <p className="text-xs text-slate-500">
              Re-score every active employee with the current model. HR is alerted about anyone who newly
              moves into high or critical risk.
            </p>
          </div>

          <button
            onClick={handleRunBatchPrediction}
            disabled={runningBatch}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-50 mt-6"
          >
            <Play className="h-4 w-4" /> {runningBatch ? "Predicting Workforce..." : "Run Batch Predictions"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">{notice}</div>
      )}

      {/* Predictions History Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Prediction Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">Most recent machine learning risk evaluations</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by risk level">
            {RISK_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => {
                  setRiskFilter(f.value);
                  setPage(1);
                }}
                aria-pressed={riskFilter === f.value}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  riskFilter === f.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Risk</th>
                <th className="px-6 py-4">Primary Drivers</th>
                <th className="px-6 py-4">Generated At</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                    <p className="mt-2 text-xs">Loading predictions log...</p>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No prediction runs recorded{riskFilter ? " at this risk level" : " yet"}.
                  </td>
                </tr>
              ) : (
                history.map((pred) => (
                  <tr key={pred.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800 block">{pred.employee_name ?? "—"}</span>
                      <span className="text-xs text-slate-500">{pred.employee_code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <RiskBadge level={pred.risk_level} score={Number(pred.prediction_score)} />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-xs">{pred.prediction_reason || "—"}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(pred.generated_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/employees/${pred.employee_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Inspect <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-3 text-xs text-slate-500">
          <span>{total} evaluations</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="font-semibold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; tone?: string; small?: boolean }> = ({
  label,
  value,
  tone = "text-slate-800",
  small,
}) => (
  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 min-w-0">
    <span className="text-[10px] text-slate-500 uppercase font-bold block">{label}</span>
    <span className={`mt-1 block font-bold ${small ? "text-xs leading-snug" : "text-lg"} ${tone}`}>{value}</span>
  </div>
);
