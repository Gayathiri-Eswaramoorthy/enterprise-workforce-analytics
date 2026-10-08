import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import type { EmployeeListItem, Department, JobRole, RiskLevel } from "../types";
import {
  Search,
  Plus,
  Users,
  UserCheck,
  TriangleAlert,
  ShieldAlert,
  Building2,
  Download,
  Table2,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RISK_COLOR, RISK_LABEL, RISK_LEVELS } from "../lib/risk";

const PAGE_SIZE = 9;

type SortKey = "risk_desc" | "risk_asc" | "name" | "joined";
type View = "table" | "cards";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "risk_desc", label: "Attrition risk (High → Low)" },
  { value: "risk_asc", label: "Attrition risk (Low → High)" },
  { value: "name", label: "Name (A → Z)" },
  { value: "joined", label: "Newest joined" },
];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  TERMINATED: "Terminated",
  RESIGNED: "Resigned",
};
const MODE_LABEL: Record<string, string> = { HYBRID: "Hybrid", OFFICE: "Office", REMOTE: "Remote" };

const initialsOf = (e: EmployeeListItem) => `${e.first_name[0] ?? ""}${e.last_name[0] ?? ""}`.toUpperCase();
const nameOf = (e: EmployeeListItem) => e.full_name || `${e.first_name} ${e.last_name}`;
const scoreOf = (e: EmployeeListItem) => (e.latest_risk_score == null ? null : Number(e.latest_risk_score));

/** 1 2 3 … 26, always keeping the first and last page. */
const pageWindow = (current: number, total: number): (number | "gap")[] => {
  const pages = new Set([1, 2, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
};

const toggled = (set: Set<string>, value: string) => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

const csvCell = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const Avatar: React.FC<{ emp: EmployeeListItem }> = ({ emp }) => (
  <span
    aria-hidden="true"
    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-link"
  >
    {initialsOf(emp)}
  </span>
);

const RiskBar: React.FC<{ emp: EmployeeListItem }> = ({ emp }) => {
  const score = scoreOf(emp);
  if (!emp.latest_risk_level || score === null) return <span className="text-xs text-ink-3">Not assessed</span>;
  return (
    <span className="flex items-center gap-3" title={`${RISK_LABEL[emp.latest_risk_level]} risk`}>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(4, Math.min(100, score))}%`, background: RISK_COLOR[emp.latest_risk_level] }}
        />
      </span>
      <span className="w-10 text-right text-[13px] font-semibold tabular-nums text-ink">{Math.round(score)}%</span>
    </span>
  );
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const good = status === "ACTIVE";
  const tone = good ? "var(--risk-low)" : status === "ON_LEAVE" ? "var(--risk-medium)" : "var(--ink-3)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
      style={{
        color: good ? "var(--risk-low)" : "var(--ink-2)",
        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} aria-hidden="true" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
};

interface FacetOption {
  value: string;
  label: string;
  count: number;
  dot?: string;
}

const FilterGroup: React.FC<{
  title: string;
  allLabel: string;
  total: number;
  options: FacetOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}> = ({ title, allLabel, total, options, selected, onToggle, onClear }) => {
  const row = (key: string, label: React.ReactNode, count: number, checked: boolean, onChange: () => void) => (
    <label key={key} className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 flex-shrink-0 rounded border-rule-strong accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-ink-3">{count}</span>
    </label>
  );
  return (
    <fieldset className="border-t border-rule pt-4">
      <legend className="float-left mb-1 w-full text-[13px] font-semibold text-ink">{title}</legend>
      <div className="clear-both">
        {row("all", allLabel, total, selected.size === 0, onClear)}
        {options.map((o) =>
          row(
            o.value,
            <span className="flex items-center gap-2">
              {o.dot && <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: o.dot }} />}
              {o.label}
            </span>,
            o.count,
            selected.has(o.value),
            () => onToggle(o.value),
          ),
        )}
      </div>
    </fieldset>
  );
};

const Kpi: React.FC<{ icon: React.ElementType; tone?: string; label: string; value: number; note?: string }> = ({
  icon: Icon,
  tone,
  label,
  value,
  note,
}) => (
  <div className="card flex items-center gap-4 p-5">
    <span
      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
      style={
        tone
          ? { color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }
          : { color: "var(--link)", background: "var(--accent-soft)" }
      }
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
    </span>
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-tight tabular-nums text-ink">{value}</span>
        {note && <span className="text-[13px] tabular-nums text-ink-3">{note}</span>}
      </p>
    </div>
  </div>
);

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters, sorting and view
  const [query, setQuery] = useState("");
  // Deep links such as /employees?department=Engineering pre-select the department facet
  const [searchParams] = useSearchParams();
  const [depts, setDepts] = useState<Set<string>>(new Set(searchParams.getAll("department")));
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [risks, setRisks] = useState<Set<string>>(new Set());
  const [modes, setModes] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("risk_desc");
  const [view, setView] = useState<View>("table");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // New Employee Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [newEmp, setNewEmp] = useState({
    employee_code: "",
    first_name: "",
    last_name: "",
    date_of_birth: "1994-01-01",
    gender: "MALE",
    phone_number: "+1-555-0100",
    official_email: "",
    department_id: "",
    job_role_id: "",
    date_of_joining: "2024-01-15",
    employment_status: "ACTIVE",
    employment_type: "FULL_TIME",
    work_mode: "HYBRID",
    work_location: "San Francisco, CA",
    overtime_frequency: "NONE",
  });

  // The whole workforce is small enough to load once, so filters, counts and sorting stay instant
  const fetchAll = useCallback(async () => {
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
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetadata = async () => {
    try {
      const [deptRes, rolesRes] = await Promise.all([api.get("/departments"), api.get("/job-roles")]);
      setDepartments(deptRes.data);
      setRoles(rolesRes.data);
      if (deptRes.data.length > 0) {
        const firstDept: Department = deptRes.data[0];
        const firstRole = (rolesRes.data as JobRole[]).find((r) => r.department_id === firstDept.id);
        setNewEmp((prev) => ({
          ...prev,
          department_id: firstDept.id,
          job_role_id: firstRole?.id ?? "",
        }));
      }
    } catch (err) {
      console.error("Failed to load departments or roles", err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Only offer job roles that belong to the chosen department
  const rolesForDept = roles.filter((r) => r.department_id === newEmp.department_id);
  const handleDeptChange = (departmentId: string) => {
    const firstRole = roles.find((r) => r.department_id === departmentId);
    setNewEmp((prev) => ({ ...prev, department_id: departmentId, job_role_id: firstRole?.id ?? "" }));
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      await api.post("/employees", newEmp);
      setShowModal(false);
      fetchAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      alert(typeof detail === "string" ? detail : "Failed to create employee record");
    } finally {
      setModalLoading(false);
    }
  };

  const facet = (valueOf: (e: EmployeeListItem) => string | undefined) => {
    const counts = new Map<string, number>();
    for (const e of employees) {
      const v = valueOf(e);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return counts;
  };

  const deptCounts = useMemo(() => facet((e) => e.department_name), [employees]);
  const statusCounts = useMemo(() => facet((e) => e.employment_status), [employees]);
  const riskCounts = useMemo(() => facet((e) => e.latest_risk_level), [employees]);
  const modeCounts = useMemo(() => facet((e) => e.work_mode), [employees]);

  const kpis = useMemo(() => {
    const at = (level: RiskLevel) => riskCounts.get(level) ?? 0;
    const total = employees.length;
    return {
      total,
      active: statusCounts.get("ACTIVE") ?? 0,
      atRisk: at("MEDIUM") + at("HIGH"),
      critical: at("CRITICAL"),
      departments: deptCounts.size,
      pct: (n: number) => (total > 0 ? `(${Math.round((n / total) * 100)}%)` : ""),
    };
  }, [employees, riskCounts, statusCounts, deptCounts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = employees.filter(
      (e) =>
        (depts.size === 0 || depts.has(e.department_name ?? "")) &&
        (statuses.size === 0 || statuses.has(e.employment_status)) &&
        (risks.size === 0 || risks.has(e.latest_risk_level ?? "")) &&
        (modes.size === 0 || modes.has(e.work_mode)) &&
        (!q ||
          `${nameOf(e)} ${e.employee_code} ${e.official_email} ${e.job_role_title ?? ""}`.toLowerCase().includes(q)),
    );
    const risk = (e: EmployeeListItem) => scoreOf(e);
    list.sort((a, b) => {
      if (sort === "name") return nameOf(a).localeCompare(nameOf(b));
      if (sort === "joined") return b.date_of_joining.localeCompare(a.date_of_joining);
      const ra = risk(a);
      const rb = risk(b);
      if (ra === null || rb === null) return ra === rb ? 0 : ra === null ? 1 : -1; // unassessed last
      return sort === "risk_asc" ? ra - rb : rb - ra;
    });
    return list;
  }, [employees, query, depts, statuses, risks, modes, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(firstIndex, firstIndex + PAGE_SIZE);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((e) => selected.has(e.id));
  const filtersActive = query || depts.size || statuses.size || risks.size || modes.size;

  const clearAll = () => {
    setQuery("");
    setDepts(new Set());
    setStatuses(new Set());
    setRisks(new Set());
    setModes(new Set());
    setPage(1);
  };

  const exportCsv = () => {
    const source = selected.size > 0 ? rows.filter((e) => selected.has(e.id)) : rows;
    const header = [
      "Employee code",
      "Name",
      "Email",
      "Department",
      "Role",
      "Work mode",
      "Status",
      "Risk level",
      "Risk score",
    ];
    const lines = source.map((e) =>
      [
        e.employee_code,
        nameOf(e),
        e.official_email,
        e.department_name,
        e.job_role_title,
        e.work_mode,
        e.employment_status,
        e.latest_risk_level,
        scoreOf(e)?.toFixed(1),
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employees.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const setFilter = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => ({
    onToggle: (value: string) => {
      setter((prev) => toggled(prev, value));
      setPage(1);
    },
    onClear: () => {
      setter(new Set());
      setPage(1);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-ink">Employees</h1>
          <p className="text-[13.5px] text-ink-2">
            View your workforce, risk indicators and take action to improve retention.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add Employee
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={Users} label="Total Employees" value={kpis.total} />
        <Kpi icon={UserCheck} tone="var(--risk-low)" label="Active" value={kpis.active} note={kpis.pct(kpis.active)} />
        <Kpi
          icon={TriangleAlert}
          tone="var(--risk-medium)"
          label="At Risk (Med/High)"
          value={kpis.atRisk}
          note={kpis.pct(kpis.atRisk)}
        />
        <Kpi
          icon={ShieldAlert}
          tone="var(--risk-critical)"
          label="Critical Risk"
          value={kpis.critical}
          note={kpis.pct(kpis.critical)}
        />
        <Kpi icon={Building2} label="Departments" value={kpis.departments} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Filters */}
        <aside className="card space-y-4 p-5" aria-label="Filters">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Filters</h2>
            <button
              onClick={clearAll}
              disabled={!filtersActive}
              className="text-[13px] font-medium text-link hover:underline disabled:cursor-default disabled:text-ink-3 disabled:no-underline"
            >
              Clear all
            </button>
          </div>

          <label className="flex h-9 items-center gap-2 rounded-lg border border-rule-strong bg-panel px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring">
            <Search className="h-4 w-4 flex-shrink-0 text-ink-3" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search people"
              placeholder="Search people..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
            />
          </label>

          <FilterGroup
            title="Department"
            allLabel="All Departments"
            total={employees.length}
            options={[...deptCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => ({ value: name, label: name, count }))}
            selected={depts}
            {...setFilter(setDepts)}
          />
          <FilterGroup
            title="Status"
            allLabel="All Statuses"
            total={employees.length}
            options={[...statusCounts.entries()].map(([value, count]) => ({
              value,
              label: STATUS_LABEL[value] ?? value,
              count,
            }))}
            selected={statuses}
            {...setFilter(setStatuses)}
          />
          <FilterGroup
            title="Risk Level"
            allLabel="All Risk Levels"
            total={employees.length}
            options={RISK_LEVELS.filter((l) => riskCounts.has(l)).map((l) => ({
              value: l,
              label: RISK_LABEL[l],
              count: riskCounts.get(l) ?? 0,
              dot: RISK_COLOR[l],
            }))}
            selected={risks}
            {...setFilter(setRisks)}
          />
          <FilterGroup
            title="Work Mode"
            allLabel="All Modes"
            total={employees.length}
            options={[...modeCounts.entries()].map(([value, count]) => ({
              value,
              label: MODE_LABEL[value] ?? value,
              count,
            }))}
            selected={modes}
            {...setFilter(setModes)}
          />
        </aside>

        {/* Results */}
        <section className="card min-w-0 overflow-hidden" aria-label="Employees">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex gap-2" role="group" aria-label="View">
              {(
                [
                  ["table", "Table", Table2],
                  ["cards", "Cards", LayoutGrid],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  onClick={() => setView(value)}
                  aria-pressed={view === value}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium transition-colors duration-150 ${
                    view === value
                      ? "border-accent bg-accent text-white"
                      : "border-rule bg-panel text-ink-2 hover:bg-sunken"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[13px] text-ink-2">
                Sort by
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as SortKey);
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-rule-strong bg-panel px-3 text-[13px] text-ink"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={exportCsv} disabled={rows.length === 0} className="btn h-9 px-3.5">
                <Download className="h-4 w-4" aria-hidden="true" />
                {selected.size > 0 ? `Export ${selected.size}` : "Export"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-16 text-ink-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
              <p className="mt-2 text-xs">Loading employee records...</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-ink-3">No employee profiles match these filters.</p>
          ) : view === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-[13px] text-ink-2">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-14" />
                  <col className="w-[24%]" />
                  <col className="w-[17%]" />
                  <col className="w-[92px]" />
                  <col className="w-[96px]" />
                  <col />
                  <col className="w-[130px]" />
                </colgroup>
                <thead>
                  <tr className="h-11 border-y border-rule bg-sunken text-left text-xs font-semibold text-ink-2">
                    <th scope="col" className="pl-4">
                      <input
                        type="checkbox"
                        aria-label="Select this page"
                        checked={allOnPageSelected}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const e of pageRows) {
                              if (allOnPageSelected) next.delete(e.id);
                              else next.add(e.id);
                            }
                            return next;
                          })
                        }
                        className="h-4 w-4 rounded border-rule-strong accent-[var(--accent)]"
                      />
                    </th>
                    <th scope="col" className="px-2 text-center">
                      S.No
                    </th>
                    <th scope="col" className="px-3">
                      Employee
                    </th>
                    <th scope="col" className="px-3">
                      Department &amp; Role
                    </th>
                    <th scope="col" className="px-3">
                      Work Mode
                    </th>
                    <th scope="col" className="px-3">
                      Status
                    </th>
                    <th scope="col" className="whitespace-nowrap px-3">
                      Attrition Risk
                    </th>
                    <th scope="col" className="px-3 text-right pr-5">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((emp, index) => (
                    <tr
                      key={emp.id}
                      className="h-[72px] border-b border-rule transition-colors duration-150 last:border-b-0 hover:bg-hover"
                    >
                      <td className="pl-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${nameOf(emp)}`}
                          checked={selected.has(emp.id)}
                          onChange={() => setSelected((prev) => toggled(prev, emp.id))}
                          className="h-4 w-4 rounded border-rule-strong accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-2 text-center text-[12.5px] tabular-nums text-ink-3">
                        {firstIndex + index + 1}
                      </td>
                      <td className="px-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar emp={emp} />
                          <div className="min-w-0">
                            <Link
                              to={`/employees/${emp.id}`}
                              className="block truncate font-semibold text-ink hover:text-link"
                            >
                              {nameOf(emp)}
                            </Link>
                            <p className="truncate text-xs text-ink-3">
                              {emp.employee_code} · {emp.official_email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3">
                        <p className="truncate font-medium text-ink">{emp.department_name ?? "-"}</p>
                        <p className="truncate text-xs text-ink-3">{emp.job_role_title ?? "-"}</p>
                      </td>
                      <td className="px-3">
                        <span className="inline-flex rounded-md border border-rule bg-sunken px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                          {emp.work_mode}
                        </span>
                      </td>
                      <td className="px-3">
                        <StatusChip status={emp.employment_status} />
                      </td>
                      <td className="px-3">
                        <RiskBar emp={emp} />
                      </td>
                      <td className="px-3 text-center">
                        <Link to={`/employees/${emp.id}`} className="btn h-8 whitespace-nowrap px-3 text-link">
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 p-4 pt-0 sm:grid-cols-2 xl:grid-cols-3">
              {pageRows.map((emp) => (
                <li key={emp.id} className="flex flex-col gap-4 rounded-xl border border-rule p-4">
                  <div className="flex items-center gap-3">
                    <Avatar emp={emp} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{nameOf(emp)}</p>
                      <p className="truncate text-xs text-ink-3">{emp.job_role_title ?? "-"}</p>
                    </div>
                    <StatusChip status={emp.employment_status} />
                  </div>
                  <p className="truncate text-[13px] text-ink-2">
                    {emp.department_name ?? "-"} · {MODE_LABEL[emp.work_mode] ?? emp.work_mode}
                  </p>
                  <RiskBar emp={emp} />
                  <Link to={`/employees/${emp.id}`} className="btn h-9 w-full text-link">
                    View Profile
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col items-center justify-between gap-3 border-t border-rule px-5 py-4 text-xs text-ink-3 sm:flex-row">
            <span>
              {rows.length === 0
                ? "No results"
                : `Showing ${firstIndex + 1}-${firstIndex + pageRows.length} of ${rows.length} employees`}
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
                      n === currentPage ? "bg-accent text-white" : "text-ink-2 hover:bg-sunken"
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

      {/* Create Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-slate-900 mb-4">Add New Employee Profile</h3>
            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Employee Code</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-ENG-099"
                    value={newEmp.employee_code}
                    onChange={(e) => setNewEmp({ ...newEmp, employee_code: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    placeholder="john.doe@workforce.local"
                    value={newEmp.official_email}
                    onChange={(e) => setNewEmp({ ...newEmp, official_email: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="John"
                    value={newEmp.first_name}
                    onChange={(e) => setNewEmp({ ...newEmp, first_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Doe"
                    value={newEmp.last_name}
                    onChange={(e) => setNewEmp({ ...newEmp, last_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                  <select
                    value={newEmp.department_id}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Job Role</label>
                  <select
                    value={newEmp.job_role_id}
                    onChange={(e) => setNewEmp({ ...newEmp, job_role_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  >
                    {rolesForDept.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Work Mode</label>
                  <select
                    value={newEmp.work_mode}
                    onChange={(e) => setNewEmp({ ...newEmp, work_mode: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  >
                    <option value="OFFICE">Office</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="REMOTE">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Joining</label>
                  <input
                    type="date"
                    required
                    value={newEmp.date_of_joining}
                    onChange={(e) => setNewEmp({ ...newEmp, date_of_joining: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={newEmp.phone_number}
                    onChange={(e) => setNewEmp({ ...newEmp, phone_number: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Overtime Frequency</label>
                  <select
                    value={newEmp.overtime_frequency}
                    onChange={(e) => setNewEmp({ ...newEmp, overtime_frequency: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  >
                    <option value="NONE">None</option>
                    <option value="OCCASIONAL">Occasional</option>
                    <option value="FREQUENT">Frequent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Work Location</label>
                  <input
                    type="text"
                    required
                    value={newEmp.work_location}
                    onChange={(e) => setNewEmp({ ...newEmp, work_location: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-accent focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-lg bg-accent text-sm font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {modalLoading ? "Saving..." : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
