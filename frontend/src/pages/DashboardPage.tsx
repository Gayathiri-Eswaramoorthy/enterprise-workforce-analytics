import React, { useState, useEffect } from "react";
import api, { getErrorMessage } from "../services/api";
import type { DashboardMetrics } from "../types";
import {
  Users,
  Activity,
  AlertTriangle,
  Award,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.get("/dashboard/summary");
        setMetrics(res.data);
      } catch (err) {
        console.error("Error loading dashboard metrics", err);
        setError(getErrorMessage(err, "Could not load dashboard metrics."));
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error ?? "Could not load dashboard metrics."}
      </div>
    );
  }

  // Pie chart risk distribution data
  const riskData = [
    { name: "Low Risk", value: metrics.risk_distribution.low, color: "#16A34A" },
    { name: "Medium Risk", value: metrics.risk_distribution.medium, color: "#D97706" },
    { name: "High Risk", value: metrics.risk_distribution.high, color: "#DC2626" },
    { name: "Critical Risk", value: metrics.risk_distribution.critical, color: "#7C3AED" },
  ].filter((item) => item.value > 0);

  // Bar chart headcount data
  const headcountData = metrics.department_distribution.map((d) => ({
    name: d.code,
    headcount: d.headcount,
  }));

  // Area chart performance history data
  const performanceData = metrics.performance_trends.map((t) => ({
    name: t.period,
    rating: parseFloat(t.average_score.toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Active Workforce */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Total Workforce
            </span>
            <span className="text-2xl font-bold text-slate-900">{metrics.total_employees}</span>
          </div>
        </div>

        {/* At-Risk Headcount */}
        <Link
          to="/predictions"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-5 hover:border-rose-200 transition-colors"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              High Attrition Risk
            </span>
            <span className="text-2xl font-bold text-slate-900">
              {metrics.high_risk_employees_count}
            </span>
          </div>
        </Link>

        {/* Avg Performance rating */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Average Performance
            </span>
            <span className="text-2xl font-bold text-slate-900">
              {metrics.average_performance_score ? metrics.average_performance_score.toFixed(1) : "N/A"}/100
            </span>
          </div>
        </div>

        {/* Pending recommendations */}
        <Link
          to="/recommendations"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-5 hover:border-sky-200 transition-colors"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Pending Actions
            </span>
            <span className="text-2xl font-bold text-slate-900">{metrics.pending_recommendations_count}</span>
          </div>
        </Link>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Headcount breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2 shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 mb-6 uppercase tracking-wider">
            Department Headcount Distribution
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={headcountData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }}
                  labelStyle={{ color: "#334155", fontWeight: "bold" }}
                />
                <Bar dataKey="headcount" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 mb-6 uppercase tracking-wider">
            Attrition Risk Segmentation
          </h3>
          <div className="h-60 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }}
                  itemStyle={{ color: "#334155" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold text-slate-900">{metrics.high_risk_employees_count}</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold">At Risk</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
            {riskData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                {item.name}: {item.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trends */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 mb-6 uppercase tracking-wider">
            Performance Index Trend
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" domain={[0, 100]} fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "8px" }}
                  itemStyle={{ color: "#334155" }}
                />
                <Area
                  type="monotone"
                  dataKey="rating"
                  stroke="#2563EB"
                  fillOpacity={1}
                  fill="url(#colorRating)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Skill Gaps */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Top Organizational Skill Gaps
            </h3>
            <Link
              to="/skills"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
            >
              Catalog <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
            {metrics.top_skill_gaps.map((gap, index) => (
              <div key={index} className="py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{gap.skill_name}</h4>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Code: {gap.skill_code}
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-semibold">
                    <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                    {gap.affected_employees_count} Affected
                  </span>
                  <p className="text-[10px] text-slate-500">Avg Gap: {gap.avg_proficiency_gap.toFixed(1)} pts</p>
                </div>
              </div>
            ))}
            {metrics.top_skill_gaps.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center">No critical skill gaps identified.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
