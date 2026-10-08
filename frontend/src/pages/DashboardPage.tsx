import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  RefreshCw,
  Rows3,
  Rows4,
  Search,
  X,
} from "lucide-react";
import api, { getErrorMessage } from "../services/api";
import type {
  DashboardMetrics,
  EmployeeListItem,
  ModelRegistryEntry,
  PredictionHistoryItem,
  Recommendation,
  RiskLevel,
} from "../types";
import { RiskStrip } from "../components/RiskStrip";
import { RiskMeter } from "../components/RiskMeter";
import { AT_RISK_LEVELS, RISK_LABEL, RISK_LEVELS, countByLevel, isRiskLevel, numberFormat } from "../lib/risk";

interface OverviewData {
  metrics: DashboardMetrics;
  employees: EmployeeListItem[];
  history: PredictionHistoryItem[];
  pending: Recommendation[];
  model: ModelRegistryEntry | null;
}

interface PersonRow {
  id: string;
  name: string;
  role: string;
  department: string;
  level: RiskLevel;
  score: number;
  drivers: string[];
  openActions: number;
}

type SortKey = "name" | "department" | "score" | "openActions";
type SortDir = "asc" | "desc";
type Density = "comfortable" | "compact";

const PAGE_SIZE = 10;
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  department: "asc",
  score: "desc",
  openActions: "desc",
};
const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
const ACTION_KIND: Record<Recommendation["recommendation_type"], string> = {
  RETENTION: "Retention",
  TRAINING: "Training",
  PROMOTION: "Promotion",
  SKILL_DEVELOPMENT: "Skill development",
};

/* Table columns. Below xl the department folds into the employee cell. */
const COLS =
  "md:grid-cols-[3rem_minmax(10rem,1.3fr)_11.5rem_minmax(9rem,1.7fr)_7rem_2rem] xl:grid-cols-[3.5rem_minmax(12rem,1.3fr)_minmax(9rem,1fr)_12.5rem_minmax(13rem,2fr)_7.5rem_2.5rem]";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Run a state change inside a view transition when the browser supports it. */
const withTransition = (update: () => void) => {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };
  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
};

/** Counts from the previous value to the target with an exponential ease-out. */
const useCountUp = (target: number, duration = 1100) => {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = t === 1 ? target : Math.round(from + (target - from) * (1 - Math.pow(2, -10 * t)));
      fromRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
};

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const sameLevels = (a: RiskLevel[], b: RiskLevel[]) => a.length === b.length && a.every((l) => b.includes(l));

const describeLevels = (levels: RiskLevel[]) => {
  if (levels.length === 0) return "No risk levels on";
  if (sameLevels(levels, AT_RISK_LEVELS)) return "Needs attention";
  if (levels.length === RISK_LEVELS.length) return "Everyone";
  const names = RISK_LEVELS.filter((l) => levels.includes(l)).map((l) => RISK_LABEL[l].toLowerCase());
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} risk`;
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Action titles end "… for <name>"; the name is already shown above the title. */
const actionTitle = (rec: Recommendation) => {
  const suffix = rec.employee_name ? ` for ${rec.employee_name}` : "";
  return suffix && rec.title.endsWith(suffix) ? rec.title.slice(0, -suffix.length) : rec.title;
};

/** "Declining trend, Low evaluation" → "Declining trend, low evaluation" (one sentence) */
const joinDrivers = (drivers: string[]) =>
  drivers.map((d, i) => (i === 0 ? d : d.charAt(0).toLowerCase() + d.slice(1))).join(", ");

const fetchOverview = async (): Promise<OverviewData> => {
  const [summaryRes, employeesRes, historyRes, recsRes, modelsRes] = await Promise.all([
    api.get("/dashboard/summary"),
    api.get("/employees", { params: { page_size: 100 } }),
    api.get("/predictions/history", { params: { page_size: 100 } }),
    api.get("/recommendations", {
      params: { status: "PENDING", page_size: 100 },
    }),
    api.get("/predictions/models"),
  ]);
  const models: ModelRegistryEntry[] = modelsRes.data;
  return {
    metrics: summaryRes.data,
    employees: employeesRes.data.items,
    history: historyRes.data.items,
    pending: recsRes.data.items,
    model: models.find((m) => m.is_active) ?? null,
  };
};

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The level tiles switch risk levels on and off; departments and search narrow further
  const [levels, setLevels] = useState<RiskLevel[]>(AT_RISK_LEVELS);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "score",
    dir: "desc",
  });
  const [page, setPage] = useState(0);
  const [density, setDensity] = useState<Density>("comfortable");
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setData(await fetchOverview());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load the overview."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const people = useMemo<PersonRow[]>(() => {
    if (!data) return [];
    const driversById = new Map<string, string[]>();
    for (const h of data.history) {
      if (!driversById.has(h.employee_id) && h.prediction_reason) {
        driversById.set(h.employee_id, h.prediction_reason.split(" • ").filter(Boolean));
      }
    }
    const openById = new Map<string, number>();
    for (const r of data.pending) openById.set(r.employee_id, (openById.get(r.employee_id) ?? 0) + 1);

    return data.employees
      .filter((e) => isRiskLevel(e.latest_risk_level) && e.latest_risk_score != null)
      .map((e) => ({
        id: e.id,
        name: e.full_name || `${e.first_name} ${e.last_name}`,
        role: e.job_role_title ?? "",
        department: e.department_name ?? "Unassigned",
        level: e.latest_risk_level as RiskLevel,
        score: Number(e.latest_risk_score),
        drivers: (driversById.get(e.id) ?? []).filter((d) => d !== "Normal workforce baseline metrics"),
        openActions: openById.get(e.id) ?? 0,
      }));
  }, [data]);

  const counts = useMemo(() => countByLevel(people, (p) => p.level), [people]);
  const atRisk = counts.HIGH + counts.CRITICAL;
  const shownAtRisk = useCountUp(atRisk);

  const departments = useMemo(() => {
    const byDept = new Map<string, PersonRow[]>();
    for (const p of people) byDept.set(p.department, [...(byDept.get(p.department) ?? []), p]);
    return [...byDept.entries()]
      .map(([name, rows]) => {
        const c = countByLevel(rows, (r) => r.level);
        return {
          name,
          counts: c,
          total: rows.length,
          atRisk: c.HIGH + c.CRITICAL,
        };
      })
      .sort((a, b) => b.atRisk / b.total - a.atRisk / a.total || b.total - a.total);
  }, [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = people.filter(
      (p) =>
        levels.includes(p.level) &&
        (!deptFilter || p.department === deptFilter) &&
        (!q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    const primary = (a: PersonRow, b: PersonRow) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name);
        case "department":
          return a.department.localeCompare(b.department);
        case "openActions":
          return a.openActions - b.openActions;
        default:
          return a.score - b.score;
      }
    };
    // Ties fall back to highest risk first, then name, whatever the direction
    return rows.sort((a, b) => primary(a, b) * dir || b.score - a.score || a.name.localeCompare(b.name));
  }, [people, levels, deptFilter, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const firstIndex = currentPage * PAGE_SIZE;
  const pageRows = filtered.slice(firstIndex, firstIndex + PAGE_SIZE);

  const urgent = useMemo(() => {
    if (!data) return [];
    return [...data.pending]
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          Number(b.recommendation_type === "RETENTION") - Number(a.recommendation_type === "RETENTION"),
      )
      .slice(0, 4);
  }, [data]);

  const toggleLevel = (level: RiskLevel) =>
    withTransition(() => {
      setLevels((current) => (current.includes(level) ? current.filter((l) => l !== level) : [...current, level]));
      setPage(0);
    });

  const selectDept = (name: string) =>
    withTransition(() => {
      setDeptFilter((current) => (current === name ? null : name));
      setPage(0);
    });

  const showEveryone = () =>
    withTransition(() => {
      setLevels(RISK_LEVELS);
      setPage(0);
    });

  const resetFilters = () =>
    withTransition(() => {
      setLevels(AT_RISK_LEVELS);
      setDeptFilter(null);
      setQuery("");
      setPage(0);
    });

  const sortBy = (key: SortKey) =>
    withTransition(() => {
      setSort((current) =>
        current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] },
      );
      setPage(0);
    });

  const goToPage = (n: number) => withTransition(() => setPage(n));

  const handleRescore = async () => {
    if (!data) return;
    setRescoring(true);
    setNotice(null);
    const before = new Map(people.map((p) => [p.id, p.level]));
    try {
      await api.post("/predictions/predict-all");
      const next = await fetchOverview();
      const escalated = next.employees.filter(
        (e) =>
          isRiskLevel(e.latest_risk_level) &&
          AT_RISK_LEVELS.includes(e.latest_risk_level) &&
          !AT_RISK_LEVELS.includes(before.get(e.id) as RiskLevel),
      ).length;
      setData(next);
      setNotice(
        escalated > 0
          ? `Re-scored ${next.employees.length} people. ${escalated} newly at high or critical risk.`
          : `Re-scored ${next.employees.length} people. No one newly moved into high or critical risk.`,
      );
    } catch (err) {
      setNotice(getErrorMessage(err, "Re-scoring failed. Try again."));
    } finally {
      setRescoring(false);
    }
  };

  const resolveAction = async (rec: Recommendation, status: "ACCEPTED" | "REJECTED") => {
    setLeaving((prev) => new Set(prev).add(rec.id));
    try {
      await api.patch(`/recommendations/${rec.id}/status`, { status });
      // Let the row fold away before it leaves the list
      window.setTimeout(() => {
        setData((prev) => (prev ? { ...prev, pending: prev.pending.filter((r) => r.id !== rec.id) } : prev));
        setLeaving((prev) => {
          const next = new Set(prev);
          next.delete(rec.id);
          return next;
        });
      }, 320);
    } catch (err) {
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
      setNotice(getErrorMessage(err, "Could not update that action."));
    }
  };

  if (error && !data) {
    return (
      <div className="card p-6">
        <p className="font-medium text-ink">The overview didn't load.</p>
        <p className="mt-1 text-sm text-ink-2">{error}</p>
        <button onClick={load} className="btn mt-4">
          Try again
        </button>
      </div>
    );
  }

  if (!data) return <OverviewSkeleton />;

  const lastScored = data.history[0]?.generated_at;
  const allOn = levels.length === RISK_LEVELS.length;
  const filtersChanged = !sameLevels(levels, AT_RISK_LEVELS) || deptFilter !== null || query !== "";
  const headline = `${atRisk} of ${people.length} people are at high or critical risk of leaving`;

  return (
    <div className="space-y-6">
      {/* Summary: the whole workforce on one risk scale, and where the risk sits */}
      <div className="grid items-stretch gap-6 xl:grid-cols-12">
        <section className="card flex flex-col p-5 sm:p-6 xl:col-span-8" aria-labelledby="overview-headline">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1
                id="overview-headline"
                aria-label={headline}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
              >
                <span
                  aria-hidden="true"
                  className="text-[44px] font-semibold leading-none tracking-[-0.035em] text-ink tabular-nums sm:text-[52px]"
                >
                  {numberFormat.format(shownAtRisk)}
                </span>
                <span aria-hidden="true" className="text-base leading-snug text-ink-2 sm:text-lg">
                  of {numberFormat.format(people.length)} people are at high or critical risk of leaving
                </span>
              </h1>
              <p className="mt-2.5 text-[13px] text-ink-3">
                {data.model &&
                  `${data.model.algorithm} ${data.model.model_version}, ${Math.round(Number(data.model.accuracy))}% test accuracy. `}
                {lastScored ? `Last scored ${dateTime.format(new Date(lastScored))}.` : "Not scored yet."}
              </p>
            </div>
            <button
              onClick={handleRescore}
              disabled={rescoring}
              aria-busy={rescoring}
              className="btn btn-primary flex-shrink-0 self-start"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${rescoring ? "animate-spin" : ""}`}
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {rescoring ? "Re-scoring…" : "Re-score everyone"}
            </button>
          </div>

          <div className="mt-8 xl:mt-auto xl:pt-8">
            <RiskStrip
              size="lg"
              counts={counts}
              selected={levels}
              onSelect={toggleLevel}
              scanning={rescoring}
              label="Workforce attrition risk"
            />
          </div>
          <p className="sr-only" aria-live="polite">
            {notice}
          </p>
          {notice && <p className="mt-4 text-[13px] text-ink-2">{notice}</p>}
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-4" aria-labelledby="dept-title">
          <div className="flex items-baseline justify-between">
            <h2 id="dept-title" className="text-[15px] font-semibold">
              By department
            </h2>
            <span className="text-xs text-ink-3">At high or critical</span>
          </div>
          <ul className="-mx-2 mt-3" onMouseLeave={() => setHoveredDept(null)}>
            {departments.map((d, i) => {
              const pressed = deptFilter === d.name;
              return (
                <li key={d.name}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => selectDept(d.name)}
                    onMouseEnter={() => setHoveredDept(d.name)}
                    onFocus={() => setHoveredDept(d.name)}
                    onBlur={() => setHoveredDept(null)}
                    className={`w-full rounded-md px-2 py-2.5 text-left transition-colors duration-150 ease-out ${
                      pressed ? "bg-accent-soft ring-1 ring-inset ring-accent-ring" : "hover:bg-hover"
                    }`}
                  >
                    <span className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className={`truncate text-[13px] font-medium ${pressed ? "text-link" : "text-ink"}`}>
                        {d.name}
                      </span>
                      <span className="flex-shrink-0 text-xs text-ink-3">
                        <span className="font-semibold text-ink">{d.atRisk}</span> of {d.total}
                      </span>
                    </span>
                    <RiskStrip counts={d.counts} delay={150 + i * 70} label={`${d.name} attrition risk`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* The people table */}
      <section className="card overflow-hidden" aria-labelledby="people-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="people-title" className="text-[15px] font-semibold">
              {describeLevels(levels)}
            </h2>
            <span className="rounded-md bg-sunken px-2 py-0.5 text-xs font-medium text-ink-2">{filtered.length}</span>
            {deptFilter && <FilterChip label={deptFilter} onClear={() => selectDept(deptFilter)} />}
            {!allOn && (
              <button
                onClick={showEveryone}
                className="ml-1 text-[13px] font-medium text-link underline-offset-4 hover:underline"
              >
                Show everyone
              </button>
            )}
            {filtersChanged && (
              <button onClick={resetFilters} className="text-[13px] font-medium text-ink-3 hover:text-ink">
                Reset
              </button>
            )}
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-rule-strong bg-panel px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring sm:flex-none">
              <Search className="h-4 w-4 flex-shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Search people</span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search name or role"
                className="w-full min-w-0 bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none sm:w-52"
              />
            </label>
            <DensitySwitch value={density} onChange={setDensity} />
          </div>
        </div>

        {/* Phones: a stacked list instead of a sideways-scrolling table */}
        <ul className="border-t border-rule md:hidden">
          {pageRows.map((p, i) => (
            <li
              key={p.id}
              className="relative border-b border-rule-soft px-5 py-3.5 transition-colors duration-150 last:border-b-0 active:bg-hover"
              style={{ viewTransitionName: `person-m-${p.id}` }}
            >
              <div className="flex items-start gap-3">
                <span className="w-5 flex-shrink-0 pt-0.5 text-right text-xs tabular-nums text-ink-3">
                  {firstIndex + i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/employees/${p.id}`}
                    className="font-medium text-ink after:absolute after:inset-0 after:content-['']"
                  >
                    {p.name}
                  </Link>
                  <span className="block truncate text-xs text-ink-3">
                    {p.role}, {p.department}
                  </span>
                </div>
                <RiskMeter level={p.level} score={p.score} compact delay={100 + i * 40} />
              </div>
              {p.drivers.length > 0 && <p className="mt-1.5 pl-8 text-[13px] text-ink-2">{joinDrivers(p.drivers)}</p>}
            </li>
          ))}
        </ul>

        <table role="table" aria-labelledby="people-title" className="hidden w-full text-left text-[13px] md:block">
          <thead role="rowgroup" className="block">
            <tr
              role="row"
              className={`grid ${COLS} h-10 items-stretch border-y border-rule-strong bg-sunken text-xs text-ink-2`}
            >
              <th
                role="columnheader"
                scope="col"
                className="flex items-center justify-center border-r border-rule px-3 font-semibold"
              >
                S.No
              </th>
              <SortHeader label="Employee" sortKey="name" sort={sort} onSort={sortBy} />
              <SortHeader
                label="Department"
                sortKey="department"
                sort={sort}
                onSort={sortBy}
                className="hidden xl:flex"
              />
              <SortHeader label="Attrition risk" sortKey="score" sort={sort} onSort={sortBy} />
              <th
                role="columnheader"
                scope="col"
                className="flex items-center justify-center border-r border-rule px-3 font-semibold"
              >
                Main drivers
              </th>
              <SortHeader label="Open actions" sortKey="openActions" sort={sort} onSort={sortBy} />
              <th role="columnheader" scope="col">
                <span className="sr-only">Profile</span>
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="block">
            {pageRows.map((p, i) => {
              const dimmed = hoveredDept !== null && hoveredDept !== p.department;
              return (
                <tr
                  key={p.id}
                  role="row"
                  className={`group relative grid ${COLS} items-stretch border-b border-rule transition-[background-color,opacity] duration-150 ease-out last:border-b-0 hover:bg-hover has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset has-[a:focus-visible]:ring-focus ${
                    density === "compact" ? "min-h-[44px]" : "min-h-[60px]"
                  }`}
                  style={{
                    viewTransitionName: `person-${p.id}`,
                    opacity: dimmed ? 0.4 : 1,
                  }}
                >
                  <td
                    role="cell"
                    className="flex items-center justify-center border-r border-rule px-3 text-[12.5px] tabular-nums text-ink-3"
                  >
                    {firstIndex + i + 1}
                  </td>
                  <td role="cell" className="flex min-w-0 items-center justify-center border-r border-rule px-3 py-2">
                    <div className="flex w-full max-w-[15rem] min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`flex flex-shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-link transition-[width,height] duration-200 ${
                          density === "compact" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[11px]"
                        }`}
                      >
                        {initialsOf(p.name)}
                      </span>
                      <span className="min-w-0">
                        <Link
                          to={`/employees/${p.id}`}
                          className="block truncate font-medium text-ink outline-none after:absolute after:inset-0 after:content-['']"
                        >
                          {p.name}
                        </Link>
                        {density === "comfortable" && (
                          <span className="block truncate text-xs text-ink-3">
                            {p.role}
                            <span className="xl:hidden">, {p.department}</span>
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td
                    role="cell"
                    className="hidden min-w-0 items-center justify-center border-r border-rule px-3 text-center text-ink-2 xl:flex"
                  >
                    <span className="truncate">{p.department}</span>
                  </td>
                  <td role="cell" className="flex items-center justify-center border-r border-rule px-3">
                    <RiskMeter level={p.level} score={p.score} delay={120 + i * 40} />
                  </td>
                  <td
                    role="cell"
                    className="flex items-center justify-center border-r border-rule px-3 py-2 text-center text-ink-2"
                  >
                    {p.drivers.length > 0 ? (
                      <span className={density === "compact" ? "line-clamp-1" : "line-clamp-2"}>
                        {joinDrivers(p.drivers)}
                      </span>
                    ) : (
                      <span className="text-ink-3">No strong drivers</span>
                    )}
                  </td>
                  <td role="cell" className="flex items-center justify-center border-r border-rule px-3 tabular-nums">
                    {p.openActions > 0 ? (
                      <span className="font-semibold text-ink">{p.openActions}</span>
                    ) : (
                      <span className="text-ink-3">None</span>
                    )}
                  </td>
                  <td role="cell" className="flex items-center justify-center">
                    <ChevronRight
                      className="h-4 w-4 text-ink-3 transition-[transform,color] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-link"
                      aria-hidden="true"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="border-t border-rule px-5 py-12 text-center">
            <p className="font-medium text-ink">
              {levels.length === 0 ? "Every risk level is switched off." : "No one matches these filters."}
            </p>
            <button
              onClick={resetFilters}
              className="mt-2 text-[13px] font-medium text-link underline underline-offset-4"
            >
              Show everyone at high or critical risk
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-3 sm:px-6">
          <p className="text-[13px] text-ink-3">
            {filtered.length > 0
              ? `Showing ${firstIndex + 1} to ${firstIndex + pageRows.length} of ${filtered.length}`
              : "Showing 0 of 0"}
          </p>
          {pageCount > 1 && (
            <nav aria-label="Table pages" className="flex items-center gap-1.5">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="btn h-8 w-8 px-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              {Array.from({ length: pageCount }, (_, n) => (
                <button
                  key={n}
                  onClick={() => goToPage(n)}
                  aria-current={n === currentPage ? "page" : undefined}
                  aria-label={`Page ${n + 1}`}
                  className={`btn h-8 min-w-8 px-2 tabular-nums ${
                    n === currentPage ? "!border-accent-ring !bg-accent-soft !text-link" : ""
                  }`}
                >
                  {n + 1}
                </button>
              ))}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= pageCount - 1}
                className="btn h-8 w-8 px-0"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Act without leaving the page */}
        <section className="card lg:col-span-7" aria-labelledby="actions-title">
          <div className="flex items-baseline justify-between px-5 pb-1 pt-5 sm:px-6">
            <h2 id="actions-title" className="text-[15px] font-semibold">
              Most urgent actions
            </h2>
            <span className="text-xs text-ink-3">{data.pending.length} pending</span>
          </div>
          {urgent.length === 0 ? (
            <p className="px-6 pb-6 pt-2 text-[13px] text-ink-2">
              Nothing pending. New actions appear here after the workforce is re-scored.
            </p>
          ) : (
            <ul className="divide-y divide-rule-soft px-5 sm:px-6">
              {urgent.map((rec, index) => {
                const exiting = leaving.has(rec.id);
                return (
                  <li
                    key={rec.id}
                    className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out-expo ${
                      exiting ? "translate-x-4 grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex gap-4 sm:items-stretch">
                        <span
                          className="flex w-8 flex-shrink-0 items-center justify-center border-r border-rule text-[12.5px] tabular-nums text-ink-3"
                          aria-label={`Number ${index + 1}`}
                        >
                          {index + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                          <div className="min-w-0">
                            <p className="text-xs text-ink-3">
                              {ACTION_KIND[rec.recommendation_type]} for{" "}
                              <Link
                                to={`/employees/${rec.employee_id}`}
                                className="font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                              >
                                {rec.employee_name}
                              </Link>
                              , {rec.priority.toLowerCase()} priority
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">
                              {actionTitle(rec)}
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 gap-2">
                            <button
                              onClick={() => resolveAction(rec, "ACCEPTED")}
                              disabled={exiting}
                              className="btn h-8 px-3 text-link"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                              Accept
                            </button>
                            <button
                              onClick={() => resolveAction(rec, "REJECTED")}
                              disabled={exiting}
                              className="h-8 rounded-lg px-3 text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:opacity-50"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {data.pending.length > urgent.length && (
            <div className="border-t border-rule px-5 py-3 sm:px-6">
              <Link
                to="/recommendations"
                className="text-[13px] font-medium text-link underline-offset-4 hover:underline"
              >
                Review all {data.pending.length} actions
              </Link>
            </div>
          )}
        </section>

        {/* Skills the workforce is short on */}
        <section className="card lg:col-span-5" aria-labelledby="gaps-title">
          <div className="flex items-baseline justify-between px-5 pt-5 sm:px-6">
            <h2 id="gaps-title" className="text-[15px] font-semibold">
              Largest skill gaps
            </h2>
            <Link to="/skills" className="text-[13px] font-medium text-link underline-offset-4 hover:underline">
              Open skills
            </Link>
          </div>
          <p className="px-5 text-xs text-ink-3 sm:px-6">
            People below their role's target level, of {people.length} assessed
          </p>
          <ul className="px-5 pb-5 pt-2 sm:px-6">
            {data.metrics.top_skill_gaps.slice(0, 5).map((gap, i) => (
              <li key={gap.skill_id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium text-ink">{gap.skill_name}</span>
                  <span className="flex-shrink-0 text-xs text-ink-3">
                    <span className="font-semibold text-ink">{gap.affected_employees_count}</span> people,{" "}
                    {gap.avg_proficiency_gap.toFixed(1)} levels short
                  </span>
                </div>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                  <span
                    className="grow block h-full rounded-full bg-accent"
                    style={{
                      width: `${people.length ? Math.max(4, (gap.affected_employees_count / people.length) * 100) : 0}%`,
                      animationDelay: `${250 + i * 70}ms`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  className?: string;
}

/** A sortable column header: the active column always shows its direction; others reveal a hint on hover. */
const SortHeader: React.FC<SortHeaderProps> = ({ label, sortKey, sort, onSort, className = "" }) => {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th
      role="columnheader"
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`flex items-center justify-center border-r border-rule px-1.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group/sort inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-1.5 font-semibold transition-colors duration-150 hover:bg-white hover:text-ink ${
          active ? "text-ink" : ""
        }`}
      >
        {label}
        <Icon
          className={`h-3.5 w-3.5 transition-opacity duration-150 ${
            active ? "text-link" : "opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100"
          }`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    </th>
  );
};

/** Row density as a segmented control; the thumb slides between the two options. */
const DensitySwitch: React.FC<{
  value: Density;
  onChange: (value: Density) => void;
}> = ({ value, onChange }) => (
  <div
    role="radiogroup"
    aria-label="Row density"
    className="relative hidden h-9 flex-shrink-0 items-center rounded-lg border border-rule-strong bg-sunken p-0.5 sm:flex"
  >
    <span
      aria-hidden="true"
      className="absolute bottom-0.5 left-0.5 top-0.5 w-8 rounded-md bg-panel shadow-card transition-transform duration-200 ease-out-expo"
      style={{
        transform: value === "compact" ? "translateX(2rem)" : "translateX(0)",
      }}
    />
    {(["comfortable", "compact"] as const).map((option) => {
      const Icon = option === "comfortable" ? Rows3 : Rows4;
      const label = option === "comfortable" ? "Comfortable rows" : "Compact rows";
      return (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          aria-label={label}
          title={label}
          onClick={() => onChange(option)}
          className={`relative z-[1] flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
            value === option ? "text-ink" : "text-ink-3 hover:text-ink"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      );
    })}
  </div>
);

const FilterChip: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <span className="inline-flex items-center gap-1 rounded-md border border-accent-ring bg-accent-soft py-0.5 pl-2 pr-1 text-xs font-medium text-link">
    {label}
    <button
      onClick={onClear}
      className="rounded p-0.5 transition-colors duration-150 hover:bg-white"
      aria-label={`Remove ${label} filter`}
    >
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  </span>
);

const OverviewSkeleton: React.FC = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading overview">
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="card p-6 xl:col-span-8">
        <div className="skeleton h-12 w-[480px] max-w-full" />
        <div className="skeleton mt-3 h-4 w-72" />
        <div className="skeleton mt-10 h-2.5 w-full" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-[74px]" />
          ))}
        </div>
      </div>
      <div className="card space-y-3 p-6 xl:col-span-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    </div>
    <div className="card space-y-3 p-6">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton h-11 w-full" />
      ))}
    </div>
  </div>
);
