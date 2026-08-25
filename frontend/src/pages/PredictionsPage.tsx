import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { PredictionResult, RiskLevel } from "../types";
import { Brain, Play, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export const PredictionsPage: React.FC = () => {
  const [history, setHistory] = useState<PredictionResult[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningBatch, setRunningBatch] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [histRes, modelsRes] = await Promise.all([
        api.get("/predictions/history", { params: { page: 1, page_size: 20 } }),
        api.get("/predictions/models"),
      ]);
      setHistory(histRes.data.items);
      setModels(modelsRes.data);
    } catch (err) {
      console.error("Failed to load predictions data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunBatchPrediction = async () => {
    setRunningBatch(true);
    try {
      const res = await api.post("/predictions/predict-all");
      alert(`Successfully generated predictions for ${res.data.length} employees.`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Batch prediction failed.");
    } finally {
      setRunningBatch(false);
    }
  };

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case "CRITICAL":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-100">Critical</span>;
      case "HIGH":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">High Risk</span>;
      case "MEDIUM":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">Low Risk</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Model Registry Card & Batch Trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Workforce Risk & Attrition ML Model</h3>
                  <p className="text-xs text-slate-500">Active production model in Model Registry</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Active Model
              </span>
            </div>

            {models.length > 0 ? (
              <div className="grid grid-cols-4 gap-4 mt-6">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Algorithm</span>
                  <span className="text-xs font-bold text-slate-700 mt-1 block truncate">{models[0].algorithm}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Accuracy</span>
                  <span className="text-lg font-bold text-emerald-600 mt-1 block">{models[0].accuracy}%</span>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">F1 Score</span>
                  <span className="text-lg font-bold text-indigo-600 mt-1 block">{models[0].f1_score}%</span>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Version</span>
                  <span className="text-xs font-bold text-slate-700 mt-1 block">{models[0].model_version}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-4">Model registry metadata unavailable.</p>
            )}
          </div>
        </div>

        {/* Batch Predictor Action Box */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Workforce Batch Inference</h3>
            <p className="text-xs text-slate-500">
              Run real-time ML risk predictions across all active employees simultaneously.
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

      {/* Predictions History Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Historical Prediction Logs</h3>
          <p className="text-xs text-slate-500 mt-0.5">Most recent machine learning risk evaluations</p>
        </div>

        <table className="w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
            <tr>
              <th className="px-6 py-4">Employee ID</th>
              <th className="px-6 py-4">Prediction Type</th>
              <th className="px-6 py-4">Attrition Risk Score</th>
              <th className="px-6 py-4">Risk Category</th>
              <th className="px-6 py-4">Generated At</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                  <p className="mt-2 text-xs">Loading predictions log...</p>
                </td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  No prediction runs recorded yet.
                </td>
              </tr>
            ) : (
              history.map((pred) => (
                <tr key={pred.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">
                    {pred.employee_id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {pred.prediction_type === "FLIGHT_RISK" ? "Attrition Risk" : pred.prediction_type}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-indigo-600">{Number(pred.prediction_score).toFixed(1)}%</span>
                  </td>
                  <td className="px-6 py-4">
                    {getRiskBadge(pred.risk_level)}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
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
    </div>
  );
};
