import React, { useState, useEffect, useCallback, useMemo } from "react";
import api, { getErrorMessage } from "../services/api";
import type {
  EmployeeListItem,
  ModelRegistryEntry,
  PredictionHistoryItem,
  PredictionResult,
  RiskLevel,
} from "../types";
import {
  Brain,
  Play,
  CheckCircle2,
  Target,
  Crosshair,
  Radar,
  Sigma,
  Clock,
  Users,
  Tag,
  Database,
  Cpu,
  ChartPie,
  ChartColumn,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
  GraduationCap,
  TrendingDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RiskBadge } from "../components/RiskBadge";
import { RiskMeter } from "../components/RiskMeter";
import { RISK_COLOR, RISK_LABEL, RISK_LEVELS, countByLevel } from "../lib/risk";
import type { RiskCounts } from "../lib/risk";

const PAGE_SIZE = 10;
const BASELINE = "Normal workforce baseline metrics";

interface TrendPoint {
  month: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

const TREND_KEY: Record<RiskLevel, keyof Omit<TrendPoint, "month">> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

/** "2026-05" -> "May 2026" */
const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleString(undefined, { month: "short", year: "numeric" });

type SortKey = "latest" | "high" | "low";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "high", label: "Highest risk" },
  { value: "low", label: "Lowest risk" },
];

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** "2 critical skill gaps" and "3 critical skill gaps" are the same signal. */
const signalLabel = (driver: string) => {
  const gaps = driver.match(/^\d+ (critical skill gaps?)$/i);
  const text = gaps ? gaps[1] : driver;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** How each known driver reads on the signals card; anything else gets a neutral look. */
const SIGNAL_META: Record<string, { icon: React.ElementType; tone: string; note: string }> = {
  "critical skill gaps": {
    icon: TriangleAlert,
    tone: "var(--risk-critical)",
    note: "Employees lacking required skills",
  },
  "low training completion": {
    icon: GraduationCap,
    tone: "var(--accent)",
    note: "Employees behind on required training",
  },
  "declining performance trend": {
    icon: TrendingDown,
    tone: "var(--risk-high)",
    note: "Negative performance trend in recent reviews",
  },
  "low performance evaluation": { icon: Users, tone: "#7c5cf0", note: "Employees with low evaluation scores" },
};
const DEFAULT_SIGNAL = { icon: ChartColumn, tone: "var(--accent)", note: "" };

const driversOf = (item: PredictionHistoryItem) =>
  (item.prediction_reason ?? "")
    .split(" • ")
    .map((d) => d.trim())
    .filter((d) => d && d !== BASELINE);

export const PredictionsPage: React.FC = () => {
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [models, setModels] = useState<ModelRegistryEntry[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [distribution, setDistribution] = useState<RiskCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningBatch, setRunningBatch] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "">("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [page, setPage] = useState(1);

  const fetchAll = useCallback(async () => {
    try {
      // The log is newest first; a few pages reach back past the latest run to the month before it
      const loadHistory = async () => {
        const items: PredictionHistoryItem[] = [];
        for (let p = 1; p <= 5; p++) {
          const res = await api.get("/predictions/history", { params: { page_size: 100, page: p } });
          items.push(...res.data.items);
          if (items.length >= res.data.total) break;
        }
        return items;
      };
      const [histItems, emps, mods, summary, trendRes] = await Promise.all([
        loadHistory(),
        api.get("/employees", { params: { page_size: 100 } }),
        api.get("/predictions/models"),
        api.get("/dashboard/summary"),
        api.get("/predictions/trend", { params: { months: 6 } }),
      ]);
      setHistory(histItems);
      setEmployees(emps.data.items);
      setModels(mods.data);
      setTrend(trendRes.data);
      const d = summary.data.risk_distribution;
      setDistribution({ LOW: d.low, MEDIUM: d.medium, HIGH: d.high, CRITICAL: d.critical });
    } catch (err) {
      console.error("Failed to load predictions", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRunBatchPrediction = async () => {
    setRunningBatch(true);
    setNotice(null);
    try {
      const res = await api.post("/predictions/predict-all");
      const results: PredictionResult[] = res.data;
      const flagged = results.filter((r) => r.risk_level === "HIGH" || r.risk_level === "CRITICAL").length;
      setNotice(`Scored ${results.length} employees - ${flagged} at high or critical attrition risk.`);
      setPage(1);
      await fetchAll();
    } catch (err) {
      setNotice(getErrorMessage(err, "Batch prediction failed."));
    } finally {
      setRunningBatch(false);
    }
  };

  const activeModel = models.find((m) => m.is_active) ?? null;
  const isFallback = activeModel?.model_version.includes("rule-based");

  const departmentOf = useMemo(() => new Map(employees.map((e) => [e.id, e.department_name ?? "-"])), [employees]);

  // The log is newest first; the first row per person is their current reading.
  const latestPerEmployee = useMemo(() => {
    const seen = new Set<string>();
    return history.filter((h) => !seen.has(h.employee_id) && seen.add(h.employee_id));
  }, [history]);

  const counts = distribution ?? countByLevel(latestPerEmployee, (h) => h.risk_level);
  const scored = RISK_LEVELS.reduce((sum, level) => sum + counts[level], 0);

  // Ten 10-point buckets; a score of exactly 100 belongs with 90-100.
  const spread = useMemo(() => {
    const buckets = Array.from({ length: 10 }, () => 0);
    for (const h of latestPerEmployee) buckets[Math.min(9, Math.floor(Number(h.prediction_score) / 10))] += 1;
    return buckets;
  }, [latestPerEmployee]);

  const spreadData = useMemo(
    () => spread.map((count, i) => ({ band: i === 9 ? "90–100" : `${i * 10}–${i * 10 + 9}`, count })),
    [spread],
  );
  const spreadMax = Math.max(10, Math.ceil(Math.max(...spread) / 10) * 10);
  const spreadTicks = Array.from({ length: spreadMax / 10 + 1 }, (_, i) => i * 10);

  // Latest reading per person within the latest month and the month before it
  const signals = useMemo(() => {
    const months = [...new Set(history.map((h) => h.generated_at.slice(0, 7)))].sort().reverse();
    const tallyFor = (month?: string) => {
      const tally = new Map<string, number>();
      if (!month) return tally;
      const seen = new Set<string>();
      for (const h of history) {
        if (h.generated_at.slice(0, 7) !== month || seen.has(h.employee_id)) continue;
        seen.add(h.employee_id);
        for (const d of new Set(driversOf(h).map(signalLabel))) tally.set(d, (tally.get(d) ?? 0) + 1);
      }
      return tally;
    };
    const now = tallyFor(months[0]);
    const before = months.length > 1 ? tallyFor(months[1]) : null;
    return [...now.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => {
        const prev = before?.get(label);
        return { label, count, change: prev ? Math.round(((count - prev) / prev) * 100) : null };
      });
  }, [history]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = history.filter(
      (h) =>
        (!riskFilter || h.risk_level === riskFilter) &&
        (!q || `${h.employee_name ?? ""} ${h.employee_code ?? ""}`.toLowerCase().includes(q)),
    );
    if (sort === "high") return [...filtered].sort((a, b) => Number(b.prediction_score) - Number(a.prediction_score));
    if (sort === "low") return [...filtered].sort((a, b) => Number(a.prediction_score) - Number(b.prediction_score));
    return filtered;
  }, [history, query, riskFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(firstIndex, firstIndex + PAGE_SIZE);
  const lastRun = latestPerEmployee.reduce<string | null>(
    (latest, h) => (!latest || h.generated_at > latest ? h.generated_at : latest),
    null,
  );

  return (
    <div className="space-y-6">
      {/* Intro and primary action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-2">
          Monitor model health, identify high-risk employees, and act before attrition happens.
        </p>
        <div className="flex items-center gap-2">
          {activeModel && (
            <span className="inline-flex h-9 items-center rounded-lg border border-rule bg-panel px-3 text-[13px] font-medium text-ink-2">
              Model {activeModel.model_version}
            </span>
          )}
          <button onClick={handleRunBatchPrediction} disabled={runningBatch} className="btn btn-primary">
            <Play className="h-4 w-4" aria-hidden="true" />
            {runningBatch ? "Predicting..." : "Run predictions"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-accent-ring bg-accent-soft px-4 py-3 text-sm text-link">{notice}</div>
      )}

      {/* Model performance */}
      <section className="card p-5 sm:p-6" aria-labelledby="model-title">
        <div className="flex flex-wrap items-center gap-3">
          <IconBox icon={Brain} />
          <div className="min-w-0">
            <h2 id="model-title" className="text-[15px] font-semibold text-ink">
              Model performance
            </h2>
            <p className="text-xs text-ink-3">
              {activeModel ? `${activeModel.algorithm} · ${activeModel.training_dataset}` : "Loading model registry..."}
            </p>
          </div>
          {activeModel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Active · {activeModel.model_version}
            </span>
          )}
        </div>

        {activeModel &&
          (isFallback ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              No trained model artifact found - predictions use the rule-based fallback heuristic. Run
              <code className="mx-1 font-mono">python ml/training/train.py</code> to train the ML model.
            </p>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric icon={Target} label="Model accuracy" value={activeModel.accuracy} />
                <Metric icon={Crosshair} label="Precision" value={activeModel.precision_score} />
                <Metric icon={Radar} label="Recall" value={activeModel.recall_score} />
                <Metric icon={Sigma} label="F1 score" value={activeModel.f1_score} />
              </div>
              <p className="mt-3 text-[11px] text-ink-3">Metrics measured on a held-out test set during training.</p>
            </>
          ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Risk distribution */}
        <section className="card p-5 sm:p-6 lg:col-span-8" aria-labelledby="dist-title">
          <div className="flex items-center gap-3">
            <IconBox icon={ChartPie} />
            <div>
              <h2 id="dist-title" className="text-[15px] font-semibold text-ink">
                Risk distribution
              </h2>
              <p className="text-xs text-ink-3">Current distribution of employees by attrition risk level</p>
            </div>
          </div>

          <div className="mt-5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
            {RISK_LEVELS.map((level) =>
              counts[level] > 0 ? (
                <span
                  key={level}
                  style={{ width: `${(counts[level] / Math.max(1, scored)) * 100}%`, background: RISK_COLOR[level] }}
                />
              ) : null,
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RISK_LEVELS.map((level) => (
              <div key={level} className="rounded-lg border border-rule p-3.5">
                <p className="flex items-center gap-2 text-[13px] text-ink-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLOR[level] }} aria-hidden="true" />
                  {RISK_LABEL[level]} risk
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-[26px] font-semibold leading-none tabular-nums text-ink">{counts[level]}</span>
                  <span className="text-xs tabular-nums text-ink-3">
                    {scored > 0 ? Math.round((counts[level] / scored) * 100) : 0}%
                  </span>
                </p>
              </div>
            ))}
          </div>

          <h3 className="mt-6 border-t border-rule pt-5 text-[13px] font-semibold text-ink">Risk trend over time</h3>
          <p className="text-xs text-ink-3">Employees at each risk level, from each month's latest prediction</p>
          {trend.length < 2 ? (
            <p className="mt-3 text-[13px] text-ink-3">
              {loading ? "Loading..." : "A trend appears once predictions span at least two months."}
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative h-64 min-w-0 flex-1" role="img" aria-label="Employees per risk level by month">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="var(--rule-soft)" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={monthLabel}
                        tickLine={false}
                        axisLine={{ stroke: "var(--rule)" }}
                        tick={{ fontSize: 12, fill: "var(--ink-3)" }}
                        padding={{ left: 16, right: 16 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "var(--ink-3)" }}
                      />
                      <Tooltip
                        labelFormatter={(ym) => monthLabel(String(ym))}
                        contentStyle={{
                          background: "var(--panel)",
                          border: "1px solid var(--rule)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      {RISK_LEVELS.map((level) => (
                        <Line
                          key={level}
                          type="linear"
                          dataKey={TREND_KEY[level]}
                          name={RISK_LABEL[level]}
                          stroke={RISK_COLOR[level]}
                          strokeWidth={2}
                          dot={{ r: 4, fill: RISK_COLOR[level], strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <ul className="flex flex-shrink-0 flex-row flex-wrap gap-x-5 gap-y-2 sm:flex-col sm:gap-3.5">
                {RISK_LEVELS.map((level) => (
                  <li key={level} className="flex items-center gap-2.5 text-[13px] text-ink-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: RISK_COLOR[level] }}
                      aria-hidden="true"
                    />
                    {RISK_LABEL[level]} <span className="tabular-nums text-ink-3">({counts[level]})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="lg:col-span-4">
          {/* Prediction center */}
          <section className="card flex flex-col p-5 sm:p-6 lg:h-full" aria-labelledby="center-title">
            <div className="flex items-center gap-3">
              <IconBox icon={Play} />
              <div>
                <h2 id="center-title" className="text-[15px] font-semibold text-ink">
                  Prediction center
                </h2>
                <p className="text-xs text-ink-3">Re-score everyone with the latest model</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2.5 rounded-lg bg-sunken p-4 text-[13px]">
              <Fact icon={Clock} label="Last run" value={lastRun ? formatWhen(lastRun) : "Not run yet"} />
              <Fact icon={Users} label="Employees scored" value={String(scored)} />
              <Fact icon={Tag} label="Model version" value={activeModel?.model_version ?? "-"} />
              <Fact icon={Cpu} label="Algorithm" value={activeModel?.algorithm ?? "-"} />
              <Fact icon={Database} label="Data source" value={activeModel?.training_dataset ?? "-"} />
            </dl>
            <p className="mb-4 mt-3 text-xs text-ink-3">
              HR is alerted about anyone who newly moves into high or critical risk.
            </p>
            {trend.length > 0 && (
              <div className="mb-4 border-t border-rule pt-4">
                <h3 className="text-[13px] font-semibold text-ink">Monthly runs</h3>
                <ul className="mt-3 space-y-3">
                  {[...trend]
                    .reverse()
                    .slice(0, 5)
                    .map((t) => {
                      const total = t.low + t.medium + t.high + t.critical;
                      return (
                        <li key={t.month}>
                          <div className="flex items-baseline justify-between text-[13px]">
                            <span className="text-ink">{monthLabel(t.month)}</span>
                            <span className="text-xs tabular-nums text-ink-3">
                              {total} scored · <span className="font-semibold text-ink">{t.high + t.critical}</span> at
                              risk
                            </span>
                          </div>
                          <span
                            className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-sunken"
                            aria-hidden="true"
                          >
                            {RISK_LEVELS.map((level) =>
                              t[TREND_KEY[level]] > 0 ? (
                                <span
                                  key={level}
                                  style={{
                                    width: `${(t[TREND_KEY[level]] / total) * 100}%`,
                                    background: RISK_COLOR[level],
                                  }}
                                />
                              ) : null,
                            )}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
            <button
              onClick={handleRunBatchPrediction}
              disabled={runningBatch}
              className="btn btn-primary mt-auto w-full"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {runningBatch ? "Predicting workforce..." : "Run batch predictions"}
            </button>
          </section>
        </div>
      </div>

      {/* Top risk signals and score spread, side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top risk signals */}
        <section className="card flex flex-col p-5 sm:p-6" aria-labelledby="signals-title">
          <div className="flex items-center gap-3">
            <IconBox icon={ChartColumn} />
            <div>
              <h2 id="signals-title" className="text-[15px] font-semibold text-ink">
                Top risk signals
              </h2>
              <p className="text-xs text-ink-3">Drivers behind current predictions</p>
            </div>
          </div>
          {signals.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-3">{loading ? "Loading..." : "No risk drivers flagged."}</p>
          ) : (
            <ul className="mt-5 flex flex-1 flex-col justify-evenly gap-3">
              {signals.map(({ label, count, change }) => {
                const meta = SIGNAL_META[label.toLowerCase()] ?? DEFAULT_SIGNAL;
                const share = scored > 0 ? Math.round((count / scored) * 100) : 0;
                const worse = change !== null && change > 0;
                return (
                  <li
                    key={label}
                    className="flex items-center gap-4 rounded-xl border border-rule px-4 py-4"
                    style={{
                      background: `linear-gradient(90deg, color-mix(in srgb, ${meta.tone} 6%, transparent), transparent 70%)`,
                    }}
                  >
                    <span
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ color: meta.tone, background: `color-mix(in srgb, ${meta.tone} 14%, transparent)` }}
                    >
                      <meta.icon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{label}</p>
                      {meta.note && <p className="truncate text-xs text-ink-3">{meta.note}</p>}
                      <div className="mt-2 flex items-center gap-3">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.max(3, share)}%`, background: meta.tone }}
                          />
                        </span>
                        <span className="w-9 text-right text-xs font-medium tabular-nums text-ink-2">{share}%</span>
                      </div>
                    </div>
                    <div className="w-16 flex-shrink-0 self-stretch border-l border-rule pl-4 text-center">
                      <p className="text-[22px] font-semibold leading-tight tabular-nums text-ink">{count}</p>
                      <p className="text-xs text-ink-3">people</p>
                    </div>
                    {change !== null && (
                      <div className="hidden w-24 flex-shrink-0 self-stretch border-l border-rule pl-4 text-center sm:block">
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums"
                          style={{
                            color: worse ? "var(--risk-critical)" : "var(--risk-low)",
                            background: `color-mix(in srgb, ${worse ? "var(--risk-critical)" : "var(--risk-low)"} 12%, transparent)`,
                          }}
                        >
                          {change > 0 ? (
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          ) : change < 0 ? (
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          ) : null}
                          {Math.abs(change)}%
                        </span>
                        <p className="mt-1 text-[11px] text-ink-3">vs last month</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Risk score spread */}
        <section className="card flex flex-col p-5 sm:p-6" aria-labelledby="spread-title">
          <div className="flex items-center gap-3">
            <IconBox icon={ChartColumn} />
            <div>
              <h2 id="spread-title" className="text-[15px] font-semibold text-ink">
                Risk score spread
              </h2>
              <p className="text-xs text-ink-3">Employees in each 10-point score band</p>
            </div>
          </div>
          <div className="mt-5 h-72 min-h-60 flex-1" role="img" aria-label="Employees per risk score band">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spreadData} margin={{ top: 22, right: 8, bottom: 22, left: 6 }} barCategoryGap="12%">
                <defs>
                  <linearGradient id="spread-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: "var(--accent)" }} />
                    <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.4 }} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--rule)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="band"
                  tickLine={false}
                  axisLine={{ stroke: "var(--rule-strong)" }}
                  tick={{ fontSize: 11, fill: "var(--ink-3)" }}
                >
                  <Label
                    value="Risk score range"
                    position="bottom"
                    offset={2}
                    style={{ fontSize: 12, fill: "var(--ink-3)" }}
                  />
                </XAxis>
                <YAxis
                  allowDecimals={false}
                  domain={[0, spreadMax]}
                  ticks={spreadTicks}
                  tickLine={false}
                  axisLine={{ stroke: "var(--rule-strong)" }}
                  tick={{ fontSize: 11, fill: "var(--ink-3)" }}
                >
                  <Label
                    value="Number of employees"
                    angle={-90}
                    position="insideLeft"
                    offset={10}
                    style={{ fontSize: 12, fill: "var(--ink-3)", textAnchor: "middle" }}
                  />
                </YAxis>
                <Tooltip
                  cursor={{ fill: "var(--hover)" }}
                  formatter={(value) => [value, "Employees"]}
                  labelFormatter={(band) => `Score ${band}`}
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--rule)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="url(#spread-fill)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    style={{ fontSize: 12, fontWeight: 600, fill: "var(--ink)" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Recent predictions */}
      <section className="card overflow-hidden" aria-labelledby="recent-title">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <IconBox icon={Brain} />
            <div>
              <h2 id="recent-title" className="text-[15px] font-semibold text-ink">
                Recent predictions
              </h2>
              <p className="text-xs text-ink-3">Most recent machine learning risk evaluations</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-rule-strong bg-panel px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring lg:w-56 lg:flex-none">
              <Search className="h-4 w-4 flex-shrink-0 text-ink-3" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search employees..."
                aria-label="Search employees"
                className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
              />
            </label>
            <select
              value={riskFilter}
              onChange={(e) => {
                setRiskFilter(e.target.value as RiskLevel | "");
                setPage(1);
              }}
              aria-label="Filter by risk level"
              className="h-9 rounded-lg border border-rule-strong bg-panel px-3 text-[13px] text-ink-2"
            >
              <option value="">All risk levels</option>
              {[...RISK_LEVELS].reverse().map((level) => (
                <option key={level} value={level}>
                  {RISK_LABEL[level]}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey);
                setPage(1);
              }}
              aria-label="Sort predictions"
              className="h-9 rounded-lg border border-rule-strong bg-panel px-3 text-[13px] text-ink-2"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Fixed layout: column widths never depend on the rows on the current page */}
          <table className="w-full min-w-[980px] table-fixed border-collapse text-[13px] text-ink-2">
            <colgroup>
              <col className="w-14" />
              <col className="w-[17%]" />
              <col className="w-[13%]" />
              <col className="w-[200px]" />
              <col className="w-[110px]" />
              <col />
              <col className="w-[110px]" />
              <col className="w-[100px]" />
            </colgroup>
            <thead>
              <tr className="h-10 border-y border-rule-strong bg-sunken text-xs">
                {[
                  "#",
                  "Employee",
                  "Department",
                  "Risk score",
                  "Risk level",
                  "Primary drivers",
                  "Scored at",
                  "Action",
                ].map((h, i, all) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-3 text-center font-semibold ${i < all.length - 1 ? "border-r border-rule" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-3">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
                    <p className="mt-2 text-xs">Loading predictions...</p>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-3">
                    {history.length === 0 ? "No prediction runs recorded yet." : "No predictions match these filters."}
                  </td>
                </tr>
              ) : (
                pageRows.map((p, i) => {
                  const drivers = driversOf(p);
                  const score = Number(p.prediction_score);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-rule transition-colors duration-150 last:border-b-0 hover:bg-hover"
                    >
                      <td className="border-r border-rule px-3 py-3 text-center text-[12.5px] tabular-nums text-ink-3">
                        {firstIndex + i + 1}
                      </td>
                      <td className="border-r border-rule px-3 py-3">
                        <div className="mx-auto flex w-full max-w-[14rem] items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-link"
                          >
                            {initialsOf(p.employee_name ?? "?")}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{p.employee_name ?? "-"}</span>
                            <span className="block truncate text-xs text-ink-3">{p.employee_code}</span>
                          </span>
                        </div>
                      </td>
                      <td className="border-r border-rule px-3 py-3 text-center">
                        {departmentOf.get(p.employee_id) ?? "-"}
                      </td>
                      <td className="border-r border-rule px-3 py-3">
                        <div className="flex justify-center">
                          <RiskMeter level={p.risk_level} score={score} delay={80 + i * 40} />
                        </div>
                      </td>
                      <td className="border-r border-rule px-3 py-3 text-center">
                        <RiskBadge level={p.risk_level} />
                      </td>
                      <td className="border-r border-rule px-3 py-3 text-center">
                        {drivers.length > 0 ? drivers.join(", ") : <span className="text-ink-3">Normal baseline</span>}
                      </td>
                      <td className="border-r border-rule px-3 py-3 text-center text-xs text-ink-3">
                        <span className="block whitespace-nowrap text-ink-2">{formatDay(p.generated_at)}</span>
                        <span className="block whitespace-nowrap">{formatClock(p.generated_at)}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Link
                          to={`/employees/${p.employee_id}`}
                          className="inline-flex items-center gap-1 text-[13px] font-medium text-link hover:underline"
                        >
                          Inspect <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-rule px-5 py-3 text-xs text-ink-3 sm:flex-row sm:px-6">
          <span>
            {rows.length === 0
              ? "No results"
              : `Showing ${firstIndex + 1} to ${firstIndex + pageRows.length} of ${rows.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="btn h-8 px-3 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Prev
            </button>
            <span className="font-semibold text-ink-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="btn h-8 px-3 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const IconBox: React.FC<{ icon: React.ElementType }> = ({ icon: Icon }) => (
  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft text-link">
    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
  </span>
);

const Metric: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 rounded-lg border border-rule p-4">
    <IconBox icon={icon} />
    <div className="min-w-0">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="text-[26px] font-semibold leading-tight tabular-nums text-ink">{Number(value).toFixed(1)}%</p>
    </div>
  </div>
);

const Fact: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
    <dt className="w-28 flex-shrink-0 text-ink-3">{label}</dt>
    <dd className="min-w-0 flex-1 break-words font-medium text-ink">{value}</dd>
  </div>
);
