import React, { useState, useEffect, useCallback, useMemo } from "react";
import api, { getErrorMessage } from "../services/api";
import type { PriorityLevel, Recommendation, RecommendationStatus, RecommendationType } from "../types";
import {
  ClipboardList,
  TriangleAlert,
  GraduationCap,
  CircleCheck,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  EllipsisVertical,
  ListChecks,
  CircleCheckBig,
  FileX,
  Lightbulb,
} from "lucide-react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 7;

const PRIORITIES: PriorityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const PRIORITY_RANK: Record<PriorityLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};
const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  CRITICAL: "var(--risk-critical)",
  HIGH: "var(--risk-high)",
  MEDIUM: "var(--risk-medium)",
  LOW: "var(--risk-low)",
};

const STATUSES: { value: RecommendationStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All statuses" },
];

const STATUS_LABEL: Record<RecommendationStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

const TYPES: { value: RecommendationType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All categories" },
  { value: "RETENTION", label: "Retention" },
  { value: "TRAINING", label: "Training" },
  { value: "SKILL_DEVELOPMENT", label: "Skill development" },
  { value: "PROMOTION", label: "Promotion" },
];

type SortKey = "priority" | "risk" | "name" | "newest";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "risk", label: "Risk score" },
  { value: "name", label: "Name" },
  { value: "newest", label: "Newest" },
];

const SKILL_TYPES: RecommendationType[] = ["TRAINING", "SKILL_DEVELOPMENT"];

const skillOf = (rec: Recommendation): string | null => {
  const fromDescription = rec.description.match(/skill gap in '([^']+)'/);
  if (fromDescription) return fromDescription[1];
  const split = rec.title.lastIndexOf(" for ");
  return split > 0 ? rec.title.slice(split + 5) : null;
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const timeAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/** 1 … 4 5 6 … 16, always keeping the first and last page. */
const pageWindow = (current: number, total: number): (number | "gap")[] => {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
};

const PriorityChip: React.FC<{ priority: PriorityLevel }> = ({ priority }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold"
    style={{
      color: PRIORITY_COLOR[priority],
      background: `color-mix(in srgb, ${PRIORITY_COLOR[priority]} 12%, transparent)`,
    }}
  >
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLOR[priority] }} aria-hidden="true" />
    {PRIORITY_LABEL[priority]}
  </span>
);

const Avatar: React.FC<{ name: string; size?: "sm" | "md" }> = ({ name, size = "md" }) => (
  <span
    aria-hidden="true"
    className={`flex flex-shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-link ${
      size === "md" ? "h-10 w-10 text-[13px]" : "h-9 w-9 text-xs"
    }`}
  >
    {initialsOf(name)}
  </span>
);

const IconBox: React.FC<{ icon: React.ElementType; tone?: string }> = ({ icon: Icon, tone }) => (
  <span
    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
    style={
      tone
        ? { color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }
        : { color: "var(--link)", background: "var(--accent-soft)" }
    }
  >
    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
  </span>
);

const Kpi: React.FC<{ icon: React.ElementType; tone?: string; label: string; value: number; note: string }> = ({
  icon,
  tone,
  label,
  value,
  note,
}) => (
  <div className="card flex items-center gap-4 p-5">
    <IconBox icon={icon} tone={tone} />
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="text-[28px] font-semibold leading-tight tabular-nums text-ink">{value}</p>
      <p className="truncate text-xs text-ink-3">{note}</p>
    </div>
  </div>
);

interface RowProps {
  rec: Recommendation;
  score?: number;
  selected: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onMenu: () => void;
  onUpdate: (id: string, status: RecommendationStatus) => void;
}

const ActionRow: React.FC<RowProps> = ({ rec, score, selected, menuOpen, onSelect, onMenu, onUpdate }) => {
  const name = rec.employee_name ?? "Employee";
  const canReject = rec.status === "PENDING" || rec.status === "ACCEPTED";
  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 transition-colors duration-150 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2 ${
        selected ? "border-accent-ring bg-accent-soft/40" : "border-rule bg-panel hover:bg-hover"
      }`}
    >
      <div className="flex items-center gap-3 lg:w-56 lg:flex-shrink-0 2xl:w-52">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${name}`}
          className="h-4 w-4 flex-shrink-0 rounded border-rule-strong accent-[var(--accent)]"
        />
        <Avatar name={name} />
        <div className="min-w-0">
          <Link
            to={`/employees/${rec.employee_id}`}
            className="block truncate text-[13.5px] font-semibold text-ink underline-offset-2 hover:underline"
          >
            {name}
          </Link>
          <p className="truncate text-xs text-ink-3">
            {rec.job_role_title ?? rec.department_name ?? rec.employee_code}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 lg:w-20">
        <PriorityChip priority={rec.priority} />
      </div>

      <p
        className="line-clamp-2 min-w-0 text-[13px] leading-snug text-ink-2 lg:order-last lg:basis-full lg:pl-[3.75rem] 2xl:order-none 2xl:flex-1 2xl:basis-0 2xl:pl-0"
        title={rec.description}
      >
        {rec.description}
      </p>

      {score !== undefined && (
        <div className="flex-shrink-0 rounded-lg bg-sunken px-3 py-1.5 text-center lg:w-[4.5rem]">
          <p className="text-[15px] font-semibold leading-tight tabular-nums text-ink">{score.toFixed(1)}</p>
          <p className="text-[10px] text-ink-3">Risk score</p>
        </div>
      )}

      <div className="flex flex-shrink-0 items-center gap-2 lg:ml-auto 2xl:ml-0">
        {rec.status === "PENDING" && (
          <button onClick={() => onUpdate(rec.id, "ACCEPTED")} className="btn btn-primary h-9 px-4">
            Accept
          </button>
        )}
        {rec.status === "ACCEPTED" && (
          <button onClick={() => onUpdate(rec.id, "COMPLETED")} className="btn btn-primary h-9 px-4">
            Mark done
          </button>
        )}
        {(rec.status === "COMPLETED" || rec.status === "REJECTED") && (
          <span className="inline-flex h-9 w-[5.25rem] items-center justify-center rounded-lg bg-sunken text-xs font-semibold text-ink-3">
            {STATUS_LABEL[rec.status]}
          </span>
        )}
        <Link to={`/employees/${rec.employee_id}`} className="btn h-9 px-4">
          Review
        </Link>
        <div className="relative w-7">
          {canReject && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMenu();
                }}
                aria-label={`More actions for ${name}`}
                aria-expanded={menuOpen}
                className="flex h-8 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-10 w-36 rounded-lg border border-rule bg-panel p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => onUpdate(rec.id, "REJECTED")}
                    className="w-full rounded-md px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-sunken hover:text-ink"
                  >
                    Reject action
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
};

export const RecommendationsPage: React.FC = () => {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [priority, setPriority] = useState<PriorityLevel | "ALL">("ALL");
  const [status, setStatus] = useState<RecommendationStatus | "ALL">("PENDING");
  const [type, setType] = useState<RecommendationType | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("priority");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);

  const fetchRecs = useCallback(async () => {
    try {
      const all: Recommendation[] = [];
      for (let p = 1; ; p++) {
        const res = await api.get("/recommendations", { params: { page_size: 100, page: p } });
        all.push(...res.data.items);
        if (all.length >= res.data.total || res.data.items.length === 0) break;
      }
      setRecs(all);

      // Latest attrition score per employee (the history is newest first)
      const hist = await api.get("/predictions/history", { params: { page_size: 100 } });
      const latest = new Map<string, number>();
      for (const h of hist.data.items)
        if (!latest.has(h.employee_id)) latest.set(h.employee_id, Number(h.prediction_score));
      setScores(latest);
    } catch (err) {
      console.error("Failed to fetch recommendations", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  // Close the row menu on any outside click
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  const handleGenerateAll = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const res = await api.post("/recommendations/generate-all");
      const created: number = res.data.created;
      setNotice(
        created > 0
          ? `Generated ${created} new action${created === 1 ? "" : "s"}.`
          : "Everything is up to date - no new actions needed.",
      );
      await fetchRecs();
    } catch (err) {
      setNotice(getErrorMessage(err, "Failed to generate recommendations."));
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (recId: string, newStatus: RecommendationStatus) => {
    setMenuId(null);
    try {
      await api.patch(`/recommendations/${recId}/status`, { status: newStatus });
      const now = new Date().toISOString();
      setRecs((prev) => prev.map((r) => (r.id === recId ? { ...r, status: newStatus, updated_at: now } : r)));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(recId);
        return next;
      });
    } catch (err) {
      alert(getErrorMessage(err, "Failed to update recommendation status."));
    }
  };

  const handleAcceptSelected = async () => {
    const ids = recs.filter((r) => selected.has(r.id) && r.status === "PENDING").map((r) => r.id);
    await Promise.all(ids.map((id) => handleUpdateStatus(id, "ACCEPTED")));
    setNotice(`Accepted ${ids.length} action${ids.length === 1 ? "" : "s"}.`);
  };

  const pending = useMemo(() => recs.filter((r) => r.status === "PENDING"), [recs]);

  const kpis = useMemo(
    () => ({
      pending: pending.length,
      atRisk: pending.filter((r) => r.recommendation_type === "RETENTION").length,
      gaps: pending.filter((r) => SKILL_TYPES.includes(r.recommendation_type)).length,
      completed: recs.filter((r) => r.status === "COMPLETED").length,
    }),
    [recs, pending],
  );

  // Filters except priority, so the pills can show how many each one would give
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recs.filter(
      (r) =>
        (status === "ALL" || r.status === status) &&
        (type === "ALL" || r.recommendation_type === type) &&
        (!q ||
          `${r.employee_name ?? ""} ${r.employee_code ?? ""} ${r.job_role_title ?? ""} ${r.title} ${r.description}`
            .toLowerCase()
            .includes(q)),
    );
  }, [recs, status, type, query]);

  const priorityCounts = useMemo(() => {
    const counts: Record<PriorityLevel, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const r of scoped) counts[r.priority] += 1;
    return counts;
  }, [scoped]);

  const rows = useMemo(() => {
    const list = priority === "ALL" ? [...scoped] : scoped.filter((r) => r.priority === priority);
    const score = (r: Recommendation) => scores.get(r.employee_id) ?? -1;
    const name = (r: Recommendation) => r.employee_name ?? "";
    list.sort((a, b) => {
      if (sort === "risk") return score(b) - score(a) || name(a).localeCompare(name(b));
      if (sort === "name") return name(a).localeCompare(name(b));
      if (sort === "newest") return b.generated_at.localeCompare(a.generated_at);
      return (
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || score(b) - score(a) || name(a).localeCompare(name(b))
      );
    });
    return list;
  }, [scoped, priority, sort, scores]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(firstIndex, firstIndex + PAGE_SIZE);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const selectedPending = recs.filter((r) => selected.has(r.id) && r.status === "PENDING").length;

  const needsAttention = useMemo(
    () =>
      pending
        .filter((r) => r.recommendation_type === "RETENTION")
        .sort(
          (a, b) =>
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            (scores.get(b.employee_id) ?? 0) - (scores.get(a.employee_id) ?? 0),
        )
        .slice(0, 3),
    [pending, scores],
  );

  // Training actions grouped by the skill they close
  const skillGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of pending) {
      if (!SKILL_TYPES.includes(r.recommendation_type)) continue;
      const skill = skillOf(r);
      if (skill) map.set(skill, (map.get(skill) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [pending]);

  const activity = useMemo(() => {
    const events: { key: string; icon: React.ElementType; tone: string; title: string; detail: string; at: string }[] =
      [];
    for (const r of recs) {
      if (r.status === "PENDING") continue;
      events.push({
        key: r.id,
        icon: r.status === "COMPLETED" ? CircleCheckBig : r.status === "ACCEPTED" ? CircleCheck : FileX,
        tone: r.status === "REJECTED" ? "var(--risk-critical)" : "var(--risk-low)",
        title:
          r.status === "ACCEPTED"
            ? "Accepted action"
            : r.status === "COMPLETED"
              ? "Completed action"
              : "Rejected action",
        detail: r.employee_name ?? "Employee",
        at: r.updated_at,
      });
    }
    events.sort((a, b) => b.at.localeCompare(a.at));
    const newest = recs.reduce<string | null>((m, r) => (!m || r.generated_at > m ? r.generated_at : m), null);
    if (newest) {
      const batch = recs.filter(
        (r) => Math.abs(new Date(r.generated_at).getTime() - new Date(newest).getTime()) < 120000,
      );
      events.push({
        key: "generated",
        icon: ListChecks,
        tone: "var(--link)",
        title: "Generated action list",
        detail: `${batch.length} action${batch.length === 1 ? "" : "s"}`,
        at: newest,
      });
      events.sort((a, b) => b.at.localeCompare(a.at));
    }
    return events.slice(0, 5);
  }, [recs]);

  const resetPage = () => setPage(1);

  const showAll = (
    nextType: RecommendationType | "ALL",
    nextPriority: PriorityLevel | "ALL" = "ALL",
    nextQuery = "",
  ) => {
    setType(nextType);
    setPriority(nextPriority);
    setStatus("PENDING");
    setQuery(nextQuery);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <p className="text-[13.5px] text-ink-2">
        Take action on retention risks, skill gaps and development opportunities.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ClipboardList} label="Pending actions" value={kpis.pending} note="Requires your review" />
        <Kpi
          icon={TriangleAlert}
          tone="var(--risk-critical)"
          label="Critical risk"
          value={kpis.atRisk}
          note="People at high risk of leaving"
        />
        <Kpi icon={GraduationCap} label="Training gaps" value={kpis.gaps} note="Skill gaps to close" />
        <Kpi
          icon={CircleCheck}
          tone="var(--risk-low)"
          label="Completed"
          value={kpis.completed}
          note="Actions completed"
        />
      </div>

      {notice && (
        <div className="rounded-lg border border-accent-ring bg-accent-soft px-4 py-3 text-sm text-link">{notice}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {/* Priority actions */}
          <section className="card flex flex-col p-5 sm:p-6 lg:h-full" aria-labelledby="actions-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="actions-title" className="text-lg font-semibold text-ink">
                  Priority actions
                </h2>
                <p className="text-[13px] text-ink-3">Review and take action on people who need immediate attention.</p>
              </div>
              <button onClick={handleGenerateAll} disabled={generating} className="btn h-9 px-3 text-link">
                <Sparkles className={`h-4 w-4 ${generating ? "animate-pulse" : ""}`} aria-hidden="true" />
                {generating ? "Analyzing workforce..." : "Generate for workforce"}
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by priority">
                {(["ALL", ...PRIORITIES] as const).map((p) => {
                  const count = p === "ALL" ? scoped.length : priorityCounts[p];
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setPriority(p);
                        resetPage();
                      }}
                      aria-pressed={active}
                      className={`h-9 rounded-lg border px-3.5 text-[13px] font-medium tabular-nums transition-colors duration-150 ${
                        active
                          ? "border-accent bg-accent text-white"
                          : "border-rule bg-panel text-ink-2 hover:bg-sunken"
                      }`}
                    >
                      {p === "ALL" ? "All" : PRIORITY_LABEL[p]} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-rule-strong bg-panel px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring min-w-40">
                  <Search className="h-4 w-4 flex-shrink-0 text-ink-3" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      resetPage();
                    }}
                    placeholder="Search people..."
                    aria-label="Search actions"
                    className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
                  />
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as RecommendationType | "ALL");
                    resetPage();
                  }}
                  aria-label="Filter by category"
                  className="h-9 rounded-lg border border-rule-strong bg-panel px-3 text-[13px] text-ink-2"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as RecommendationStatus | "ALL");
                    resetPage();
                  }}
                  aria-label="Filter by status"
                  className="h-9 rounded-lg border border-rule-strong bg-panel px-3 text-[13px] text-ink-2"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as SortKey);
                    resetPage();
                  }}
                  aria-label="Sort actions"
                  className="h-9 rounded-lg border border-rule-strong bg-panel px-3 text-[13px] text-ink-2"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      Sort by: {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulk bar */}
            <div className="mt-4 flex min-h-9 flex-wrap items-center gap-3 text-[13px] text-ink-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const r of pageRows) {
                        if (allOnPageSelected) next.delete(r.id);
                        else next.add(r.id);
                      }
                      return next;
                    })
                  }
                  className="h-4 w-4 rounded border-rule-strong accent-[var(--accent)]"
                />
                Select this page
              </label>
              {selected.size > 0 && (
                <>
                  <span className="text-ink-3">{selected.size} selected</span>
                  {selectedPending > 0 && (
                    <button onClick={handleAcceptSelected} className="btn btn-primary h-8 px-3 text-xs">
                      Accept {selectedPending} selected
                    </button>
                  )}
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs font-medium text-link hover:underline"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
              </div>
            ) : rows.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-rule-strong p-10 text-center">
                <Lightbulb className="mx-auto mb-3 h-8 w-8 text-ink-3" aria-hidden="true" />
                <p className="text-sm font-semibold text-ink">No actions match these filters.</p>
                <p className="mt-1 text-xs text-ink-3">
                  Actions come from skill gaps and the latest attrition-risk predictions.
                </p>
              </div>
            ) : (
              <ul className="mt-2 space-y-2.5">
                {pageRows.map((rec) => (
                  <ActionRow
                    key={rec.id}
                    rec={rec}
                    score={scores.get(rec.employee_id)}
                    selected={selected.has(rec.id)}
                    menuOpen={menuId === rec.id}
                    onSelect={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(rec.id)) next.delete(rec.id);
                        else next.add(rec.id);
                        return next;
                      })
                    }
                    onMenu={() => setMenuId(menuId === rec.id ? null : rec.id)}
                    onUpdate={handleUpdateStatus}
                  />
                ))}
              </ul>
            )}

            <div className="mt-auto flex flex-col items-center justify-between gap-3 pt-5 text-xs text-ink-3 sm:flex-row">
              <span>
                {rows.length === 0
                  ? "No results"
                  : `Showing ${firstIndex + 1}-${firstIndex + pageRows.length} of ${rows.length} actions`}
              </span>
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  className="btn h-8 w-8 px-0"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {pageWindow(currentPage, totalPages).map((n, i) =>
                  n === "gap" ? (
                    <span key={`gap-${i}`} className="px-1.5">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      aria-current={n === currentPage ? "page" : undefined}
                      className={`h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium tabular-nums ${
                        n === currentPage ? "bg-accent-soft text-link" : "text-ink-2 hover:bg-sunken"
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                  className="btn h-8 w-8 px-0"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Needs attention */}
          <section className="card p-5 sm:p-6" aria-labelledby="attention-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="attention-title" className="text-lg font-semibold text-ink">
                  Needs attention
                </h2>
                <p className="text-[13px] text-ink-3">Critical retention cases requiring immediate action.</p>
              </div>
              <button
                onClick={() => showAll("RETENTION")}
                className="inline-flex flex-shrink-0 items-center gap-1 pt-1 text-[13px] font-medium text-link hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            {needsAttention.length === 0 ? (
              <p className="mt-4 text-[13px] text-ink-3">
                {loading ? "Loading..." : "No retention cases need attention."}
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {needsAttention.map((rec) => (
                  <li key={rec.id}>
                    <Link
                      to={`/employees/${rec.employee_id}`}
                      className="flex items-center gap-3 rounded-xl border border-rule p-3 transition-colors duration-150 hover:bg-hover"
                    >
                      <Avatar name={rec.employee_name ?? "?"} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">
                            {rec.employee_name}
                          </span>
                          <span className="flex-shrink-0">
                            <PriorityChip priority={rec.priority} />
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-2 text-xs text-ink-3">
                          <span className="truncate">{rec.job_role_title ?? rec.department_name}</span>
                          {scores.has(rec.employee_id) && (
                            <span className="flex-shrink-0 font-semibold tabular-nums text-ink">
                              {scores.get(rec.employee_id)!.toFixed(1)}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-xs text-ink-2">{rec.description}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-3" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Training recommendations */}
          <section className="card flex flex-col p-5 sm:p-6 lg:flex-1" aria-labelledby="training-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="training-title" className="text-lg font-semibold text-ink">
                  Training recommendations
                </h2>
                <p className="text-[13px] text-ink-3">Top skill gaps to focus on.</p>
              </div>
              <button
                onClick={() => showAll("TRAINING")}
                className="inline-flex flex-shrink-0 items-center gap-1 pt-1 text-[13px] font-medium text-link hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            {skillGroups.length === 0 ? (
              <p className="mt-4 text-[13px] text-ink-3">{loading ? "Loading..." : "No skill gaps to close."}</p>
            ) : (
              <ul className="mt-4 flex flex-1 flex-col justify-evenly divide-y divide-rule">
                {skillGroups.slice(0, 6).map(([skill, count]) => (
                  <li key={skill}>
                    <button
                      onClick={() => showAll("TRAINING", "ALL", skill)}
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors duration-150 hover:bg-hover"
                    >
                      <IconBoxSmall icon={GraduationCap} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{skill}</span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${(count / skillGroups[0][1]) * 100}%` }}
                          />
                        </span>
                      </span>
                      <span className="flex-shrink-0 text-xs tabular-nums text-ink-2">{count} people</span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Action activity */}
      <section className="card p-5 sm:px-6" aria-labelledby="activity-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="activity-title" className="text-lg font-semibold text-ink">
              Action activity
            </h2>
            <p className="text-[13px] text-ink-3">Recent actions and decisions taken by you and your team.</p>
          </div>
          <button
            onClick={() => {
              setStatus("ALL");
              setType("ALL");
              setPriority("ALL");
              setSort("newest");
              setQuery("");
              setPage(1);
              document.getElementById("actions-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="btn h-9 px-3 text-link"
          >
            View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        {activity.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-3">{loading ? "Loading..." : "No activity yet."}</p>
        ) : (
          <ol className="mt-5 flex flex-col gap-5 md:flex-row md:items-center">
            {activity.map((e, i) => (
              <React.Fragment key={e.key}>
                {i > 0 && (
                  <li
                    aria-hidden="true"
                    className="hidden h-px min-w-6 flex-1 items-center justify-center bg-rule md:flex"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-rule-strong" />
                  </li>
                )}
                <li className="flex items-center gap-3 md:flex-shrink-0">
                  <span
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ color: e.tone, background: `color-mix(in srgb, ${e.tone} 12%, transparent)` }}
                  >
                    <e.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{e.title}</p>
                    <p className="max-w-[11rem] truncate text-[13px] text-ink-2">{e.detail}</p>
                    <p className="text-xs text-ink-3">{timeAgo(e.at)}</p>
                  </div>
                </li>
              </React.Fragment>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};

const IconBoxSmall: React.FC<{ icon: React.ElementType }> = ({ icon: Icon }) => (
  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-link">
    <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden="true" />
  </span>
);
