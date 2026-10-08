import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Department, EmployeeListItem } from "../types";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Cpu,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Kpi } from "../components/Kpi";
import { Field, Modal } from "../components/Modal";
import { RISK_COLOR, RISK_LABEL, RISK_LEVELS, countByLevel, type RiskCounts } from "../lib/risk";

type SortKey = "name" | "people" | "risk";
type StatusFilter = "all" | "active" | "inactive";

interface DeptStats {
  people: number;
  active: number;
  counts: RiskCounts;
  atRisk: number;
  avgScore: number | null;
  criticalGaps: number | null;
}

interface DeptForm {
  department_code: string;
  name: string;
  description: string;
  is_active: boolean;
}

const EMPTY_FORM: DeptForm = { department_code: "", name: "", description: "", is_active: true };

const SORTS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name (A → Z)" },
  { value: "people", label: "Headcount (High → Low)" },
  { value: "risk", label: "At-risk share (High → Low)" },
];

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const DepartmentsPage: React.FC = () => {
  const { user } = useAuth();
  const isHr = user?.role === "HR_ADMIN" || user?.role === "HR_MANAGER";
  const isAdmin = user?.role === "HR_ADMIN";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [gaps, setGaps] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [form, setForm] = useState<DeptForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/departments");
      const depts: Department[] = res.data;
      setDepartments(depts);
      if (!isHr) return;

      // Risk and skill-gap figures are HR-only; a failure here still leaves the directory usable
      const all: EmployeeListItem[] = [];
      for (let p = 1; p <= 20; p++) {
        const page = await api.get("/employees", { params: { page: p, page_size: 100 } });
        all.push(...page.data.items);
        if (all.length >= page.data.total || page.data.items.length === 0) break;
      }
      setEmployees(all);

      const summaries = await Promise.all(
        depts.map((d) =>
          api
            .get(`/analytics/skill-gaps/department/${d.id}`)
            .then((r) => [d.id, r.data.critical_gaps as number] as const)
            .catch(() => [d.id, 0] as const),
        ),
      );
      setGaps(Object.fromEntries(summaries));
    } catch (err) {
      console.error("Failed to load departments", err);
    } finally {
      setLoading(false);
    }
  }, [isHr]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const map = new Map<string, DeptStats>();
    for (const d of departments) {
      const members = employees.filter((e) => e.department_id === d.id && !e.is_deleted);
      const scored = members.filter((e) => e.latest_risk_score != null);
      const counts = countByLevel(members, (e) => e.latest_risk_level);
      map.set(d.id, {
        people: d.employee_count ?? members.length,
        active: members.filter((e) => e.employment_status === "ACTIVE").length,
        counts,
        atRisk: counts.HIGH + counts.CRITICAL,
        avgScore: scored.length
          ? scored.reduce((sum, e) => sum + Number(e.latest_risk_score), 0) / scored.length
          : null,
        criticalGaps: isHr ? (gaps[d.id] ?? 0) : null,
      });
    }
    return map;
  }, [departments, employees, gaps, isHr]);

  const share = (d: Department) => {
    const s = stats.get(d.id);
    return s && s.people > 0 ? s.atRisk / s.people : 0;
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return departments
      .filter((d) => {
        if (statusFilter === "active" && d.is_active === false) return false;
        if (statusFilter === "inactive" && d.is_active !== false) return false;
        return (
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.department_code.toLowerCase().includes(q) ||
          (d.description ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sort === "people") return (stats.get(b.id)?.people ?? 0) - (stats.get(a.id)?.people ?? 0);
        if (sort === "risk") return share(b) - share(a);
        return a.name.localeCompare(b.name);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, query, statusFilter, sort, stats]);

  const totals = useMemo(() => {
    let people = 0;
    let atRisk = 0;
    let criticalGaps = 0;
    for (const s of stats.values()) {
      people += s.people;
      atRisk += s.atRisk;
      criticalGaps += s.criticalGaps ?? 0;
    }
    return { people, atRisk, criticalGaps };
  }, [stats]);

  const maxGaps = Math.max(1, ...departments.map((d) => stats.get(d.id)?.criticalGaps ?? 0));
  const maxPeople = Math.max(1, ...departments.map((d) => stats.get(d.id)?.people ?? 0));
  const hotspots = useMemo(
    () =>
      departments
        .filter((d) => (stats.get(d.id)?.atRisk ?? 0) > 0)
        .sort((a, b) => share(b) - share(a))
        .slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [departments, stats],
  );

  const openEditor = (dept: Department | "new") => {
    setEditing(dept);
    setFormError(null);
    setForm(
      dept === "new"
        ? EMPTY_FORM
        : {
            department_code: dept.department_code,
            name: dept.name,
            description: dept.description ?? "",
            is_active: dept.is_active !== false,
          },
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = { ...form, description: form.description.trim() || null };
    try {
      if (editing === "new") await api.post("/departments", payload);
      else if (editing) await api.put(`/departments/${editing.id}`, payload);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not save the department"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-16 w-80" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-ink">Departments</h1>
          <p className="text-[13.5px] text-ink-2">
            Teams across the organization, with headcount, retention risk and skill gaps at a glance.
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => openEditor("new")} className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add Department
          </button>
        )}
      </div>

      {/* Summary */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isHr ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
        <Kpi icon={Building2} label="Departments" value={departments.length} />
        <Kpi icon={Users} label="Total employees" value={totals.people} />
        {isHr && (
          <>
            <Kpi
              icon={ShieldAlert}
              tone="var(--risk-high)"
              label="At risk (High/Critical)"
              value={totals.atRisk}
              note={totals.people ? `${Math.round((totals.atRisk / totals.people) * 100)}%` : undefined}
            />
            <Kpi icon={Cpu} tone="var(--risk-critical)" label="Critical skill gaps" value={totals.criticalGaps} />
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="card-raised flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, code or description..."
            aria-label="Search departments"
            className="field pl-9"
          />
        </div>
        <div className="well flex p-0.5" role="group" aria-label="Status">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              aria-pressed={statusFilter === t.value}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                statusFilter === t.value ? "bg-panel text-ink shadow-card" : "text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isHr && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort departments"
            className="field w-auto"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Department cards */}
        <div
          className={`grid grid-cols-1 content-start gap-5 md:grid-cols-2 ${isHr ? "lg:col-span-8" : "lg:col-span-12 xl:grid-cols-3"}`}
        >
          {visible.length === 0 && (
            <div className="card-raised col-span-full py-16 text-center text-sm text-ink-3">
              No departments match your search.
            </div>
          )}
          {isAdmin && visible.length > 0 && visible.length % 2 === 1 && !query && statusFilter === "all" && (
            <button
              onClick={() => openEditor("new")}
              className="order-last hidden min-h-[16rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-rule-strong text-ink-3 transition-colors hover:border-accent hover:bg-accent-soft hover:text-link md:flex"
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
              <span className="text-[13px] font-medium">Add department</span>
            </button>
          )}
          {visible.map((d) => {
            const s = stats.get(d.id)!;
            const inactive = d.is_active === false;
            return (
              <article key={d.id} className={`card-raised card-lift flex flex-col p-5 ${inactive ? "opacity-75" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      color: "var(--link)",
                      background: "linear-gradient(145deg, var(--accent-soft), #dfe9fd)",
                      boxShadow: "inset 0 0 0 1px var(--accent-ring), 0 2px 6px -2px rgb(37 99 235 / 0.35)",
                    }}
                  >
                    <Building2 className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-sunken px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                      {d.department_code}
                    </span>
                    {inactive && (
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-3">
                        Inactive
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => openEditor(d)}
                        aria-label={`Edit ${d.name}`}
                        className="rounded-md p-1.5 text-ink-3 hover:bg-sunken hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="mt-4 text-[16px] font-semibold text-ink">{d.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] text-ink-2">
                  {d.description || "No description provided."}
                </p>

                <dl className="well mt-4 grid grid-cols-3 divide-x divide-rule text-center">
                  <Stat icon={Users} label="People" value={s.people} />
                  <Stat icon={Briefcase} label="Roles" value={d.job_roles_count ?? 0} />
                  {isHr ? (
                    <Stat icon={Cpu} label="Critical gaps" value={s.criticalGaps ?? 0} tone="var(--risk-critical)" />
                  ) : (
                    <Stat icon={Users} label="Active" value={d.is_active === false ? 0 : s.people} />
                  )}
                </dl>

                {isHr && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-2">Retention risk</span>
                      <span className="tabular-nums text-ink-3">
                        {s.avgScore != null ? `Avg score ${Math.round(s.avgScore)}` : "Not scored"}
                      </span>
                    </div>
                    <div
                      className="flex h-2 overflow-hidden rounded-full bg-sunken"
                      role="img"
                      aria-label={RISK_LEVELS.map((l) => `${s.counts[l]} ${RISK_LABEL[l]}`).join(", ")}
                    >
                      {RISK_LEVELS.map((l) =>
                        s.counts[l] > 0 ? (
                          <span
                            key={l}
                            style={{
                              width: `${(s.counts[l] / Math.max(1, s.people)) * 100}%`,
                              background: RISK_COLOR[l],
                            }}
                          />
                        ) : null,
                      )}
                    </div>
                    <div className="mt-2 flex gap-3 text-[11px] text-ink-3">
                      {RISK_LEVELS.map((l) => (
                        <span key={l} className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK_COLOR[l] }} />
                          <span className="tabular-nums">{s.counts[l]}</span> {RISK_LABEL[l]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {isHr && (
                  <div className="mt-auto pt-4">
                    <Link
                      to={`/employees?department=${encodeURIComponent(d.name)}`}
                      className="flex items-center justify-between border-t border-rule-soft pt-4 text-[13px] font-medium text-link hover:underline"
                    >
                      View people <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {isHr && (
          <div className="flex flex-col gap-6 lg:sticky lg:top-4 lg:col-span-4 lg:self-start">
            <section className="card-raised p-5">
              <h2 className="text-[15px] font-semibold text-ink">Headcount by department</h2>
              <p className="mb-4 text-[13px] text-ink-2">Share of the largest team.</p>
              <ul className="space-y-3">
                {[...departments]
                  .sort((a, b) => (stats.get(b.id)?.people ?? 0) - (stats.get(a.id)?.people ?? 0))
                  .map((d) => {
                    const n = stats.get(d.id)?.people ?? 0;
                    return (
                      <li key={d.id}>
                        <div className="mb-1 flex justify-between text-[13px]">
                          <span className="truncate text-ink">{d.name}</span>
                          <span className="tabular-nums text-ink-2">{n}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-sunken">
                          <div
                            className="grow h-full rounded-full"
                            style={{
                              width: `${(n / maxPeople) * 100}%`,
                              background: "linear-gradient(90deg, var(--accent), #5b8ef0)",
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>

            <section className="card-raised p-5">
              <div className="mb-4 flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-risk-high" aria-hidden="true" />
                <h2 className="text-[15px] font-semibold text-ink">Risk hotspots</h2>
              </div>
              {hotspots.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ink-3">No department has high-risk employees.</p>
              ) : (
                <ol className="space-y-3">
                  {hotspots.map((d, i) => {
                    const s = stats.get(d.id)!;
                    return (
                      <li key={d.id}>
                        <Link
                          to={`/employees?department=${encodeURIComponent(d.name)}`}
                          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-hover"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-xs font-semibold tabular-nums text-ink-2">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">{d.name}</span>
                            <span className="block text-xs text-ink-3">
                              {s.atRisk} of {s.people} at risk
                            </span>
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-risk-high">
                            {Math.round(share(d) * 100)}%
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="card-raised p-5">
              <div className="mb-4 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-risk-critical" aria-hidden="true" />
                <h2 className="text-[15px] font-semibold text-ink">Critical skill gaps</h2>
              </div>
              <ul className="space-y-3">
                {[...departments]
                  .sort((a, b) => (stats.get(b.id)?.criticalGaps ?? 0) - (stats.get(a.id)?.criticalGaps ?? 0))
                  .map((d) => {
                    const n = stats.get(d.id)?.criticalGaps ?? 0;
                    return (
                      <li key={d.id}>
                        <div className="mb-1 flex justify-between text-[13px]">
                          <span className="truncate text-ink">{d.name}</span>
                          <span className="tabular-nums text-ink-2">{n}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-sunken">
                          <div
                            className="grow h-full rounded-full"
                            style={{ width: `${(n / maxGaps) * 100}%`, background: "var(--risk-critical)" }}
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editing === "new" ? "Add department" : `Edit ${editing.name}`}
          subtitle="Departments group employees and job roles."
          onClose={() => setEditing(null)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Code">
                <input
                  required
                  minLength={2}
                  maxLength={20}
                  className="field uppercase"
                  value={form.department_code}
                  onChange={(e) => setForm({ ...form, department_code: e.target.value })}
                  placeholder="ENG"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Name">
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    className="field"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Engineering"
                  />
                </Field>
              </div>
            </div>
            <Field label="Description">
              <textarea
                rows={3}
                className="field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            {editing !== "new" && (
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Active department
              </label>
            )}
            {formError && (
              <p
                role="alert"
                className="rounded-lg px-3 py-2 text-[13px] text-risk-critical"
                style={{ background: "color-mix(in srgb, var(--risk-critical) 8%, transparent)" }}
              >
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-3 border-t border-rule-soft pt-4">
              <button type="button" onClick={() => setEditing(null)} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : editing === "new" ? "Create department" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const Stat: React.FC<{ icon: React.ElementType; label: string; value: number; tone?: string }> = ({
  icon: Icon,
  label,
  value,
  tone,
}) => (
  <div className="px-2 py-2.5">
    <dd
      className="flex items-center justify-center gap-1.5 text-[18px] font-semibold tabular-nums"
      style={{ color: tone ?? "var(--ink)" }}
    >
      <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      {value}
    </dd>
    <dt className="text-[11px] text-ink-3">{label}</dt>
  </div>
);
