import React, { useState, useEffect, useCallback, useMemo } from "react";
import api, { getErrorMessage } from "../services/api";
import type {
  EmployeeListItem,
  EmployeeRequest,
  InterventionStatus,
  PriorityLevel,
  Recommendation,
  RecommendationStatus,
  RecommendationType,
  RetentionIntervention,
  RetentionOutcome,
} from "../types";
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
  Plus,
  Clock,
  UserCheck,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Modal, Field } from "../components/Modal";

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

const INTERVENTION_STATUS_LABEL: Record<InterventionStatus, string> = {
  OFFERED: "Offered",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  COMPLETED: "Completed",
};

const OUTCOME_LABEL: Record<RetentionOutcome, string> = {
  PENDING: "Pending Follow-up",
  EMPLOYED: "Retained (Employed)",
  DEPARTED: "Departed",
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
  onTrackIntervention?: () => void;
}

const ActionRow: React.FC<RowProps> = ({
  rec,
  score,
  selected,
  menuOpen,
  onSelect,
  onMenu,
  onUpdate,
  onTrackIntervention,
}) => {
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
                <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-rule bg-panel p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      onTrackIntervention?.();
                      onMenu();
                    }}
                    className="w-full rounded-md px-3 py-2 text-left text-[13px] font-medium text-link hover:bg-sunken hover:text-ink"
                  >
                    Track Intervention
                  </button>
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

  // Retention Intervention State
  const [activeTab, setActiveTab] = useState<"recommendations" | "retention" | "requests">("recommendations");
  const [interventions, setInterventions] = useState<RetentionIntervention[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [createInterventionModal, setCreateInterventionModal] = useState(false);
  const [updateInterventionModal, setUpdateInterventionModal] = useState<RetentionIntervention | null>(null);
  const [savingIntervention, setSavingIntervention] = useState(false);
  const [interventionError, setInterventionError] = useState<string | null>(null);

  // Employee Discussion Requests State
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [reviewRequestModal, setReviewRequestModal] = useState<EmployeeRequest | null>(null);
  const [requestReviewForm, setRequestReviewForm] = useState({
    status: "SCHEDULED",
    response_notes: "",
  });
  const [savingRequestReview, setSavingRequestReview] = useState(false);

  const [createForm, setCreateForm] = useState({
    employee_id: "",
    recommendation_id: undefined as string | undefined,
    concern_summary: "",
    proposed_intervention: "",
    intervention_type: "WORKLOAD_REVIEW",
    follow_up_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    notes: "",
  });

  const [updateForm, setUpdateForm] = useState({
    status: "OFFERED" as InterventionStatus,
    retention_outcome: "PENDING" as RetentionOutcome,
    intervention_effectiveness: "PENDING_ASSESSMENT",
    follow_up_date: "",
    notes: "",
    outcome_notes: "",
  });

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

  const fetchInterventions = useCallback(async () => {
    try {
      const res = await api.get("/retention/interventions");
      setInterventions(res.data);
    } catch (err) {
      console.error("Failed to fetch retention interventions", err);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const all: EmployeeListItem[] = [];
      for (let p = 1; p <= 20; p++) {
        const res = await api.get("/employees", { params: { page: p, page_size: 100 } });
        all.push(...res.data.items);
        if (all.length >= res.data.total || res.data.items.length === 0) break;
      }
      setEmployees(all);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await api.get("/employees/discussion-requests");
      setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch discussion requests", err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchRecs();
    fetchInterventions();
    fetchEmployees();
    fetchRequests();
  }, [fetchRecs, fetchInterventions, fetchEmployees, fetchRequests]);

  // Close the row menu on any outside click
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  const handleOpenInterventionForRec = (rec: Recommendation) => {
    setCreateForm({
      employee_id: rec.employee_id,
      recommendation_id: rec.id,
      concern_summary: rec.description || rec.title,
      proposed_intervention:
        rec.recommendation_type === "RETENTION"
          ? "Targeted 1-on-1 retention interview, workload review, and career-development planning."
          : `Structured capability building and mentor pairing for ${rec.title}.`,
      intervention_type: rec.recommendation_type === "RETENTION" ? "WORKLOAD_REVIEW" : "TRAINING",
      follow_up_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
      notes: `Initiated from ${rec.priority.toLowerCase()} priority recommendation.`,
    });
    setInterventionError(null);
    setCreateInterventionModal(true);
  };

  const handleSaveIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntervention(true);
    setInterventionError(null);
    try {
      await api.post("/retention/interventions", {
        employee_id: createForm.employee_id,
        recommendation_id: createForm.recommendation_id || null,
        concern_summary: createForm.concern_summary,
        intervention_type: createForm.intervention_type,
        status: "OFFERED",
        follow_up_date: createForm.follow_up_date || null,
        notes: createForm.notes.trim() || null,
      });
      setCreateInterventionModal(false);
      await fetchInterventions();
      setNotice("Retention intervention recorded successfully.");
    } catch (err) {
      setInterventionError(getErrorMessage(err, "Failed to create intervention"));
    } finally {
      setSavingIntervention(false);
    }
  };

  const handleOpenUpdateIntervention = (item: RetentionIntervention) => {
    setUpdateInterventionModal(item);
    setUpdateForm({
      status: item.status,
      retention_outcome: item.retention_outcome,
      intervention_effectiveness: item.intervention_effectiveness || "PENDING_ASSESSMENT",
      follow_up_date: item.follow_up_date || "",
      notes: item.notes || "",
      outcome_notes: item.outcome_notes || "",
    });
    setInterventionError(null);
  };

  const handleSaveUpdateIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateInterventionModal) return;
    setSavingIntervention(true);
    setInterventionError(null);
    try {
      await api.put(`/retention/interventions/${updateInterventionModal.id}`, {
        status: updateForm.status,
        retention_outcome: updateForm.retention_outcome,
        intervention_effectiveness: updateForm.intervention_effectiveness || null,
        follow_up_date: updateForm.follow_up_date || null,
        notes: updateForm.notes.trim() || null,
        outcome_notes: updateForm.outcome_notes.trim() || null,
        completed_date:
          updateForm.status === "COMPLETED"
            ? updateInterventionModal.completed_date || new Date().toISOString().split("T")[0]
            : null,
      });
      setUpdateInterventionModal(null);
      await fetchInterventions();
      setNotice("Retention intervention updated.");
    } catch (err) {
      setInterventionError(getErrorMessage(err, "Failed to update intervention"));
    } finally {
      setSavingIntervention(false);
    }
  };

  const handleOpenReviewRequest = (req: EmployeeRequest) => {
    setReviewRequestModal(req);
    setRequestReviewForm({
      status: req.status === "PENDING" ? "SCHEDULED" : req.status,
      response_notes: req.response_notes || "",
    });
  };

  const handleSaveReviewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRequestModal) return;
    setSavingRequestReview(true);
    try {
      await api.patch(`/employees/discussion-requests/${reviewRequestModal.id}`, {
        status: requestReviewForm.status,
        response_notes: requestReviewForm.response_notes.trim() || null,
      });
      setReviewRequestModal(null);
      await fetchRequests();
      setNotice("Discussion request updated successfully.");
    } catch (err) {
      alert(getErrorMessage(err, "Failed to update discussion request"));
    } finally {
      setSavingRequestReview(false);
    }
  };

  const handleConvertRequestToIntervention = (req: EmployeeRequest) => {
    setCreateForm({
      employee_id: req.employee_id,
      recommendation_id: undefined,
      concern_summary: `Employee discussion request: ${req.topic}`,
      proposed_intervention: req.notes
        ? `Follow-up support: ${req.notes}`
        : "1-on-1 career development and support discussion",
      intervention_type: req.request_type === "LEARNING_INTEREST" ? "TRAINING" : "CAREER_DEVELOPMENT",
      follow_up_date: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
      notes: `Initiated from employee request #${req.id.slice(0, 8)} (${req.request_type})`,
    });
    setInterventionError(null);
    setCreateInterventionModal(true);
  };

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
      <div>
        <h1 className="text-[28px] font-semibold leading-tight text-ink">Recommendations & Retention</h1>
        <p className="text-[13.5px] text-ink-2">
          Take action on retention risks, skill gaps, and track longitudinal retention interventions.
        </p>
      </div>

      <div className="flex border-b border-rule-soft gap-2">
        <button
          onClick={() => setActiveTab("recommendations")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "recommendations"
              ? "border-accent text-link font-semibold"
              : "border-transparent text-ink-2 hover:text-ink"
          }`}
        >
          <ListChecks className="inline-block mr-1.5 h-4 w-4" /> Action Items Backlog
        </button>
        <button
          onClick={() => setActiveTab("retention")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "retention"
              ? "border-accent text-link font-semibold"
              : "border-transparent text-ink-2 hover:text-ink"
          }`}
        >
          <Sparkles className="inline-block mr-1.5 h-4 w-4" /> Retention Interventions & Follow-up
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "requests"
              ? "border-accent text-link font-semibold"
              : "border-transparent text-ink-2 hover:text-ink"
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Employee Discussion Requests
          {requests.filter((r) => r.status === "PENDING").length > 0 && (
            <span className="ml-1 inline-flex items-center rounded-full bg-accent text-white px-2 py-0.5 text-xs font-bold">
              {requests.filter((r) => r.status === "PENDING").length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "recommendations" && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ClipboardList} label="Pending actions" value={kpis.pending} note="Requires your review" />
        <Kpi
          icon={TriangleAlert}
          tone="var(--risk-critical)"
          label="Critical risk"
          value={kpis.atRisk}
          note="Employees with high predicted attrition risk"
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
                    onTrackIntervention={() => handleOpenInterventionForRec(rec)}
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
        </>
      )}

      {/* Tab: Retention Interventions & Follow-up */}
      {activeTab === "retention" && (
        <div className="space-y-6">
          {/* Retention KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={ClipboardList}
              label="Tracked Interventions"
              value={interventions.length}
              note="Active HR retention plans"
            />
            <Kpi
              icon={Clock}
              tone="var(--risk-medium)"
              label="Offered / In Progress"
              value={interventions.filter((i) => i.status === "OFFERED" || i.status === "ACCEPTED").length}
              note="Awaiting follow-up milestone"
            />
            <Kpi
              icon={CircleCheck}
              tone="var(--risk-low)"
              label="Completed Interventions"
              value={interventions.filter((i) => i.status === "COMPLETED").length}
              note="Concluded intervention programs"
            />
            <Kpi
              icon={UserCheck}
              tone="var(--risk-low)"
              label="Documented Retained"
              value={interventions.filter((i) => i.retention_outcome === "EMPLOYED").length}
              note={`${interventions.filter((i) => i.retention_outcome === "DEPARTED").length} departed · ${interventions.filter((i) => i.retention_outcome === "PENDING").length} pending`}
            />
          </div>

          {/* Interventions Table Card */}
          <section className="card p-5 sm:p-6" aria-labelledby="retention-table-title">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 id="retention-table-title" className="text-lg font-semibold text-ink">
                  Retention Interventions & Follow-up Tracking
                </h2>
                <p className="text-[13px] text-ink-3">
                  Structured HR interventions for attrition-risk employees with documented 3- and 6-month employment outcomes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateForm({
                    employee_id: employees.length > 0 ? employees[0].id : "",
                    recommendation_id: undefined,
                    concern_summary: "High attrition risk identified via workforce predictive model",
                    proposed_intervention: "1-on-1 workload rebalancing and compensation/growth review discussion",
                    intervention_type: "WORKLOAD_REVIEW",
                    follow_up_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
                    notes: "",
                  });
                  setInterventionError(null);
                  setCreateInterventionModal(true);
                }}
                className="btn btn-primary h-9 px-4 text-xs"
              >
                <Plus className="h-4 w-4 mr-1" /> Log New Intervention
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] table-fixed text-left text-[13px] text-ink">
                <colgroup>
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead className="border-b border-rule bg-sunken text-xs font-semibold text-ink-2">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Identified Concern</th>
                    <th className="px-4 py-3">Intervention Type</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Follow-up Date</th>
                    <th className="px-4 py-3 text-center">Documented Outcome</th>
                    <th className="px-4 py-3 text-center">Effectiveness</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-soft">
                  {interventions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-ink-3">
                        No retention interventions recorded yet. Click "Log New Intervention" or track an action from the recommendations backlog.
                      </td>
                    </tr>
                  )}
                  {interventions.map((item) => (
                    <tr key={item.id} className="hover:bg-hover">
                      <td className="px-4 py-3">
                        <Link
                          to={`/employees/${item.employee_id}`}
                          className="font-medium text-ink hover:underline block truncate"
                        >
                          {item.employee_name || "Employee"}
                        </Link>
                        <div className="text-xs text-ink-3">
                          {item.employee_code} · {item.department_name || item.job_title}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="line-clamp-2 text-ink text-xs leading-snug" title={item.concern_summary}>
                          {item.concern_summary}
                        </div>
                        <div className="text-[11px] text-ink-3 mt-1 truncate">
                          Resp: {item.hr_user_name || "HR Team"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-md border border-rule px-2 py-0.5 text-xs font-medium bg-sunken text-ink-2">
                          {item.intervention_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : item.status === "ACCEPTED"
                              ? "bg-accent-soft text-link"
                              : item.status === "DECLINED"
                              ? "bg-risk-critical/10 text-risk-critical"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {INTERVENTION_STATUS_LABEL[item.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs font-medium text-ink tabular-nums">
                          {item.follow_up_date || "—"}
                        </div>
                        {item.follow_up_date && (
                          <div className="text-[10px] text-ink-3">
                            {new Date(item.follow_up_date) <= new Date() ? "Milestone due" : "Scheduled"}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.retention_outcome === "EMPLOYED"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : item.retention_outcome === "DEPARTED"
                              ? "bg-sunken text-ink-3"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {OUTCOME_LABEL[item.retention_outcome]}
                        </span>
                        {item.outcome_notes && (
                          <div
                            className="text-[11px] text-ink-3 mt-0.5 truncate max-w-[130px] mx-auto"
                            title={item.outcome_notes}
                          >
                            {item.outcome_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.intervention_effectiveness === "HELPFUL"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : item.intervention_effectiveness === "UNHELPFUL"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : item.intervention_effectiveness === "NEUTRAL"
                              ? "bg-sunken text-ink-2"
                              : "bg-sunken text-ink-3"
                          }`}
                        >
                          {item.intervention_effectiveness === "HELPFUL"
                            ? "Helpful"
                            : item.intervention_effectiveness === "UNHELPFUL"
                            ? "Unhelpful"
                            : item.intervention_effectiveness === "NEUTRAL"
                            ? "Neutral"
                            : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenUpdateIntervention(item)}
                          className="btn h-8 text-xs font-medium"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-lg border border-rule-soft bg-sunken/50 p-4 text-xs text-ink-3 space-y-1">
              <p className="font-semibold text-ink-2">Methodological & Data Governance Note:</p>
              <p>
                Retention follow-up records capture structured HR interventions and verifiable employment outcomes at scheduled intervals (typically 3 or 6 months post-intervention). In accordance with organizational standards, causal efficacy must not be inferred solely from observational employment status. Model feature schemas and ML pipelines remain strictly independent of these intervention records.
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Tab: Employee Discussion Requests */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={MessageSquare}
              label="Discussion Requests"
              value={requests.length}
              note="Voluntary employee inquiries"
            />
            <Kpi
              icon={Clock}
              tone="var(--risk-medium)"
              label="Pending Review"
              value={requests.filter((r) => r.status === "PENDING").length}
              note="Awaiting HR review"
            />
            <Kpi
              icon={CircleCheck}
              tone="var(--link)"
              label="Scheduled / In Review"
              value={requests.filter((r) => r.status === "SCHEDULED" || r.status === "IN_REVIEW").length}
              note="Conversations arranged"
            />
            <Kpi
              icon={UserCheck}
              tone="var(--risk-low)"
              label="Resolved / Followed Up"
              value={requests.filter((r) => r.status === "RESOLVED").length}
              note="Outcomes addressed"
            />
          </div>

          <section className="card p-5 sm:p-6" aria-labelledby="requests-table-title">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 id="requests-table-title" className="text-lg font-semibold text-ink">
                  Employee Career & Learning Discussion Requests
                </h2>
                <p className="text-[13px] text-ink-3">
                  Inquiries voluntarily submitted by employees seeking career discussions, workload reviews, or learning guidance. HR Managers can review the situation, schedule 1-on-1s, or convert requests directly into structured retention interventions.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] table-fixed text-left text-[13px] text-ink">
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 160 }} />
                </colgroup>
                <thead className="border-b border-rule bg-sunken text-xs font-semibold text-ink-2">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Request Type</th>
                    <th className="px-4 py-3">Topic & Context</th>
                    <th className="px-4 py-3 text-center">Submitted</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-soft">
                  {loadingRequests ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-ink-3">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-ink-3">
                        No employee discussion requests submitted yet.
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req.id} className="hover:bg-hover">
                        <td className="px-4 py-3">
                          <Link
                            to={`/employees/${req.employee_id}`}
                            className="font-medium text-ink hover:underline block truncate"
                          >
                            {req.employee_name || "Employee"}
                          </Link>
                          <div className="text-xs text-ink-3">
                            {req.employee_code} · {req.department_name || req.job_title}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-md border border-rule px-2 py-0.5 text-xs font-medium bg-sunken text-ink-2">
                            {req.request_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink text-xs line-clamp-1">{req.topic}</div>
                          {req.notes && (
                            <div className="text-[11px] text-ink-3 line-clamp-2 mt-0.5" title={req.notes}>
                              {req.notes}
                            </div>
                          )}
                          {req.response_notes && (
                            <div className="mt-1 text-[11px] text-link bg-accent-soft/40 rounded px-1.5 py-0.5">
                              HR: {req.response_notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-ink-3 tabular-nums">
                          {req.created_at ? new Date(req.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              req.status === "RESOLVED"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : req.status === "SCHEDULED" || req.status === "IN_REVIEW"
                                ? "bg-accent-soft text-link"
                                : req.status === "CANCELLED"
                                ? "bg-sunken text-ink-3"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenReviewRequest(req)}
                              className="btn h-7 px-2 text-xs font-medium"
                            >
                              Respond
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConvertRequestToIntervention(req)}
                              className="btn btn-primary h-7 px-2 text-xs font-medium"
                              title="Create retention intervention from this request"
                            >
                              Intervention
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Modal: Log New Retention Intervention */}
      {createInterventionModal && (
        <Modal
          title="Log Retention Intervention"
          subtitle="Document proposed HR intervention, responsible specialist, and scheduled 3- or 6-month follow-up milestone."
          onClose={() => setCreateInterventionModal(false)}
        >
          <form onSubmit={handleSaveIntervention} className="space-y-4">
            <Field label="Employee">
              <select
                required
                className="field"
                value={createForm.employee_id}
                onChange={(e) => setCreateForm({ ...createForm, employee_id: e.target.value })}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.department_name || ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Intervention Type">
              <select
                className="field"
                value={createForm.intervention_type}
                onChange={(e) => setCreateForm({ ...createForm, intervention_type: e.target.value })}
              >
                <option value="WORKLOAD_REVIEW">Workload Review & Re-balancing</option>
                <option value="CAREER_DEVELOPMENT">Career Development & Pathing Discussion</option>
                <option value="MANAGER_CHECK_IN">Manager Check-in & Alignment</option>
                <option value="TRAINING">Targeted Upskilling & Training</option>
                <option value="MENTORING">Senior Leadership Mentoring</option>
                <option value="COMPENSATION_REVIEW">Compensation & Market Alignment Review</option>
                <option value="FLEXIBLE_WORK">Flexible Work Arrangement</option>
                <option value="OTHER_SUPPORT">Other Support & Wellbeing</option>
              </select>
            </Field>

            <Field label="Identified Concern Summary">
              <textarea
                required
                rows={2}
                className="field"
                placeholder="Specific attrition risk or skill gap identified..."
                value={createForm.concern_summary}
                onChange={(e) => setCreateForm({ ...createForm, concern_summary: e.target.value })}
              />
            </Field>

            <Field label="Proposed Intervention Plan">
              <textarea
                required
                rows={2}
                className="field"
                placeholder="Action steps agreed upon with the employee..."
                value={createForm.proposed_intervention}
                onChange={(e) => setCreateForm({ ...createForm, proposed_intervention: e.target.value })}
              />
            </Field>

            <div>
              <Field label="Scheduled Follow-up Milestone Date">
                <input
                  type="date"
                  className="field"
                  value={createForm.follow_up_date}
                  onChange={(e) => setCreateForm({ ...createForm, follow_up_date: e.target.value })}
                />
              </Field>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm({
                      ...createForm,
                      follow_up_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
                    })
                  }
                  className="rounded border border-rule px-2 py-1 text-xs text-ink-2 hover:bg-hover"
                >
                  +3 Months
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm({
                      ...createForm,
                      follow_up_date: new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0],
                    })
                  }
                  className="rounded border border-rule px-2 py-1 text-xs text-ink-2 hover:bg-hover"
                >
                  +6 Months
                </button>
              </div>
            </div>

            <Field label="Initial Notes (Optional)">
              <textarea
                rows={2}
                className="field"
                placeholder="Additional HR context or documentation references..."
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              />
            </Field>

            {interventionError && (
              <p className="rounded-lg bg-risk-critical/10 p-3 text-xs text-risk-critical font-medium">
                {interventionError}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-rule-soft pt-4">
              <button type="button" onClick={() => setCreateInterventionModal(false)} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={savingIntervention} className="btn btn-primary">
                {savingIntervention ? "Saving..." : "Log Intervention"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Update Intervention & Retention Outcome */}
      {updateInterventionModal && (
        <Modal
          title="Update Retention Intervention"
          subtitle={`Employee: ${updateInterventionModal.employee_name || "Employee"} · Type: ${updateInterventionModal.intervention_type.replace(/_/g, " ")}`}
          onClose={() => setUpdateInterventionModal(null)}
        >
          <form onSubmit={handleSaveUpdateIntervention} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Intervention Status">
                <select
                  className="field"
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value as InterventionStatus })}
                >
                  <option value="OFFERED">Offered</option>
                  <option value="ACCEPTED">Accepted / In Progress</option>
                  <option value="DECLINED">Declined</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </Field>

              <Field label="Documented Retention Outcome">
                <select
                  className="field"
                  value={updateForm.retention_outcome}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, retention_outcome: e.target.value as RetentionOutcome })
                  }
                >
                  <option value="PENDING">Pending (Still under observation)</option>
                  <option value="EMPLOYED">Employed (Retained in organization)</option>
                  <option value="DEPARTED">Departed (Left organization)</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Next Follow-up Date">
                <input
                  type="date"
                  className="field"
                  value={updateForm.follow_up_date}
                  onChange={(e) => setUpdateForm({ ...updateForm, follow_up_date: e.target.value })}
                />
              </Field>

              <Field label="Intervention Effectiveness (Observed Impact)">
                <select
                  className="field"
                  value={updateForm.intervention_effectiveness}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, intervention_effectiveness: e.target.value })
                  }
                >
                  <option value="PENDING_ASSESSMENT">Pending Assessment</option>
                  <option value="HELPFUL">Helpful (Observed positive progress / feedback)</option>
                  <option value="NEUTRAL">Neutral (No noticeable change)</option>
                  <option value="UNHELPFUL">Unhelpful (Did not address employee situation)</option>
                </select>
              </Field>
            </div>

            <Field label="Outcome Notes & Evidence Documentation">
              <textarea
                rows={3}
                className="field"
                placeholder="Factual notes documenting employment status or reasons for departure/retention..."
                value={updateForm.outcome_notes}
                onChange={(e) => setUpdateForm({ ...updateForm, outcome_notes: e.target.value })}
              />
            </Field>

            <Field label="General Progress Notes">
              <textarea
                rows={2}
                className="field"
                placeholder="Update on meeting outcomes, actions taken, or employee sentiment..."
                value={updateForm.notes}
                onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
              />
            </Field>

            {interventionError && (
              <p className="rounded-lg bg-risk-critical/10 p-3 text-xs text-risk-critical font-medium">
                {interventionError}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-rule-soft pt-4">
              <button type="button" onClick={() => setUpdateInterventionModal(null)} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={savingIntervention} className="btn btn-primary">
                {savingIntervention ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Review Employee Discussion Request */}
      {reviewRequestModal && (
        <Modal
          title="Review Discussion Request"
          subtitle={`Employee: ${reviewRequestModal.employee_name || "Employee"} · Topic: ${reviewRequestModal.topic}`}
          onClose={() => setReviewRequestModal(null)}
        >
          <form onSubmit={handleSaveReviewRequest} className="space-y-4">
            <div className="rounded-lg bg-sunken/60 p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">Employee Inquiry Details</p>
              <p className="text-ink-2">
                <span className="text-ink-3">Type:</span> {reviewRequestModal.request_type.replace(/_/g, " ")}
              </p>
              {reviewRequestModal.notes && (
                <p className="text-ink-2">
                  <span className="text-ink-3">Notes:</span> {reviewRequestModal.notes}
                </p>
              )}
            </div>

            <Field label="Request Status">
              <select
                className="field"
                value={requestReviewForm.status}
                onChange={(e) => setRequestReviewForm({ ...requestReviewForm, status: e.target.value })}
              >
                <option value="PENDING">Pending</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="SCHEDULED">Scheduled (Meeting set)</option>
                <option value="RESOLVED">Resolved (Completed discussion)</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </Field>

            <Field label="Response Notes / Follow-up Details for Employee">
              <textarea
                rows={3}
                required
                className="field"
                placeholder="e.g. Scheduled 1-on-1 check-in with HR Manager for Thursday 2 PM to review workload and growth goals..."
                value={requestReviewForm.response_notes}
                onChange={(e) => setRequestReviewForm({ ...requestReviewForm, response_notes: e.target.value })}
              />
            </Field>

            <div className="flex justify-end gap-3 border-t border-rule-soft pt-4">
              <button type="button" onClick={() => setReviewRequestModal(null)} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={savingRequestReview} className="btn btn-primary">
                {savingRequestReview ? "Saving..." : "Save Response"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const IconBoxSmall: React.FC<{ icon: React.ElementType }> = ({ icon: Icon }) => (
  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-link">
    <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden="true" />
  </span>
);
