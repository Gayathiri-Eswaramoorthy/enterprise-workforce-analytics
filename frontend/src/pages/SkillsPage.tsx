import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { EmployeeSkill, Skill } from "../types";
import { Cpu, Download, FileSpreadsheet, FileText, Flag, Layers, Pencil, Plus, Search, TriangleAlert, Users } from "lucide-react";
import { Field, Modal } from "../components/Modal";
import { FacetGroup, toggled } from "../components/FacetGroup";
import { Pager } from "../components/Pager";
import { downloadCsv, openFormattedPdfReport } from "../utils/exportReports";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PAGE_SIZE = 9;
interface SkillGapEmployee {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department_name: string;
  job_role_title: string;
  current_proficiency: number;
  required_proficiency: number;
  gap: number;
  mandatory: boolean;
}

type SortKey = "name" | "gap" | "category";
type Availability = "all" | "active" | "inactive";

interface GapInfo {
  affected: number;
  avgGap: number;
  mandatory: number;
}

interface SkillForm {
  skill_code: string;
  name: string;
  skill_category: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

const EMPTY_FORM: SkillForm = {
  skill_code: "",
  name: "",
  skill_category: "",
  description: "",
  display_order: 0,
  is_active: true,
};

/** Categories are labels, not statuses, so they get their own hues and never reuse the risk colors. */
const CATEGORY_HUES = ["#2563eb", "#7c3aed", "#0891b2", "#4d7c0f", "#4338ca", "#0f766e", "#475569"];
const hueFor = (category: string) => {
  let h = 0;
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CATEGORY_HUES[h % CATEGORY_HUES.length];
};

const SORTS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name (A → Z)" },
  { value: "gap", label: "Most affected employees" },
  { value: "category", label: "Category" },
];

export const SkillsPage: React.FC = () => {
  const { user } = useAuth();
  const isHr = user?.role === "HR_ADMIN" || user?.role === "HR_MANAGER";
  const ownEmployeeId = user?.employee_id ?? null;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [gapBySkill, setGapBySkill] = useState<Record<string, GapInfo>>({});
  const [topGaps, setTopGaps] = useState<{ skill_id: string; skill_name: string; affected_employees_count: number }[]>(
    [],
  );
  const [mine, setMine] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<Availability>("all");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [noGapsOnly, setNoGapsOnly] = useState(false);
  const [gapEmployees, setGapEmployees] = useState<SkillGapEmployee[]>([]);
  const [gapEmployeesError, setGapEmployeesError] = useState<string | null>(null);
  const [selectedGapSkill, setSelectedGapSkill] = useState<{ id: string; name: string } | null>(null);
  const [loadingGapEmployees, setLoadingGapEmployees] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Skill | "new" | null>(null);
  const [form, setForm] = useState<SkillForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportSkills = (format: "csv" | "pdf") => {
    setShowExportMenu(false);
    const headers = [
      "Skill Code",
      "Skill Name",
      "Category",
      "Affected Headcount",
      "Mandatory Gaps",
      "Average Gap",
      "Status",
    ];

    if (format === "csv") {
      const rows = skills.map((s) => {
        const gap = gapBySkill[s.id];
        return [
          s.skill_code,
          s.name,
          s.skill_category,
          gap?.affected ?? 0,
          gap?.mandatory ?? 0,
          gap?.avgGap ? gap.avgGap.toFixed(1) : "0.0",
          s.is_active !== false ? "ACTIVE" : "INACTIVE",
        ];
      });
      downloadCsv(`Workforce_Skill_Gap_Matrix_${new Date().toISOString().split("T")[0]}`, headers, rows);
      return;
    }

    // Formatted PDF Report
    const totalAffected = Object.values(gapBySkill).reduce((acc, g) => acc + (g.affected || 0), 0);
    const totalMandatory = Object.values(gapBySkill).reduce((acc, g) => acc + (g.mandatory || 0), 0);
    const skillsWithGapsCount = Object.values(gapBySkill).filter((g) => (g.affected || 0) > 0).length;

    const tableRows: (string | number | { text: string; badge?: "low" | "medium" | "high" | "critical" | "neutral" })[][] = skills.map((s) => {
      const gap = gapBySkill[s.id];
      const affected = gap?.affected ?? 0;
      const mandatory = gap?.mandatory ?? 0;
      const affectedBadge: "critical" | "medium" | "low" = affected > 5 ? "critical" : affected > 0 ? "medium" : "low";
      const mandatoryBadge: "critical" | "neutral" = mandatory > 0 ? "critical" : "neutral";
      const statusBadge: "low" | "neutral" = s.is_active !== false ? "low" : "neutral";
      return [
        s.skill_code,
        s.name,
        s.skill_category,
        { text: String(affected), badge: affectedBadge },
        { text: String(mandatory), badge: mandatoryBadge },
        gap?.avgGap ? gap.avgGap.toFixed(1) : "0.0",
        { text: s.is_active !== false ? "ACTIVE" : "INACTIVE", badge: statusBadge },
      ];
    });

    openFormattedPdfReport({
      title: "Workforce Skill-Gap & Competency Matrix Report",
      subtitle: "Enterprise-wide technical capability mapping, role requirements, and priority training deficits",
      reportCode: "REP-SKILL-DEFICIT-04",
      generatedBy: "HR Talent & Learning",
      kpis: [
        { label: "Catalog Skills", value: skills.length, subtext: "Active competencies" },
        { label: "Skills with Gaps", value: skillsWithGapsCount, tone: "warning", subtext: "Deficiencies observed" },
        { label: "Mandatory Gaps", value: totalMandatory, tone: "danger", subtext: "Contractual role requirements" },
        { label: "Total Gap Instances", value: totalAffected, tone: "accent", subtext: "Employees impacted" },
      ],
      tableHeaders: headers,
      tableRows,
      summaryNotes: [
        "A skill gap indicates an employee's verified proficiency level is below the baseline requirement for their role.",
        "Mandatory gaps represent critical job performance dependencies and should be scheduled for training enrollment.",
      ],
    });
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get("/skills");
      setSkills(res.data);

      if (isHr) {
        const gaps = await api.get("/analytics/skill-gaps/top", { params: { limit: 50 } });
        const map: Record<string, GapInfo> = {};
        for (const g of gaps.data) {
          map[g.skill_id] = {
            affected: g.affected_employees_count,
            avgGap: g.avg_proficiency_gap,
            mandatory: g.mandatory_gaps_count,
          };
        }
        setGapBySkill(map);
        setTopGaps(gaps.data.slice(0, 5));
      } else if (ownEmployeeId) {
        const own = await api.get(`/employees/${ownEmployeeId}/skills`);
        setMine(Object.fromEntries((own.data as EmployeeSkill[]).map((s) => [s.skill_id, s.proficiency_level])));
      }
    } catch (err) {
      console.error("Failed to load skills catalog", err);
    } finally {
      setLoading(false);
    }
  }, [isHr, ownEmployeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of skills) m.set(s.skill_category, (m.get(s.skill_category) ?? 0) + 1);
    return m;
  }, [skills]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills
      .filter(
        (s) =>
          (!q ||
            s.name.toLowerCase().includes(q) ||
            s.skill_code.toLowerCase().includes(q) ||
            s.skill_category.toLowerCase().includes(q)) &&
          (categories.size === 0 || categories.has(s.skill_category)) &&
          (availability === "all" || (availability === "active") === (s.is_active !== false)) &&
          (!gapsOnly || (gapBySkill[s.id]?.affected ?? 0) > 0) &&
          (!noGapsOnly || (gapBySkill[s.id]?.affected ?? 0) === 0),
      )
      .sort((a, b) => {
        if (sort === "gap") return (gapBySkill[b.id]?.affected ?? 0) - (gapBySkill[a.id]?.affected ?? 0);
        if (sort === "category")
          return a.skill_category.localeCompare(b.skill_category) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
  }, [skills, query, categories, availability, gapsOnly, noGapsOnly, sort, gapBySkill]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const maxAffected = Math.max(1, ...Object.values(gapBySkill).map((g) => g.affected));
  const filtersActive = query || categories.size > 0 || availability !== "all" || gapsOnly || noGapsOnly;

  const clearAll = () => {
    setQuery("");
    setCategories(new Set());
    setAvailability("all");
    setGapsOnly(false);
    setNoGapsOnly(false);
    setPage(1);
  };

  const focusCatalog = () => {
    window.setTimeout(() => document.getElementById("skills-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const showGapEmployees = async (skillId: string, skillName: string) => {
    setSelectedGapSkill({ id: skillId, name: skillName });
    setGapEmployees([]);
    setGapEmployeesError(null);
    setLoadingGapEmployees(true);
    try {
      const response = await api.get(`/analytics/skill-gaps/skill/${skillId}/employees`);
      setGapEmployees(response.data);
    } catch (err) {
      console.error("Could not load employees with this skill gap", err);
      setGapEmployeesError(getErrorMessage(err, "Could not load employees for this skill."));
    } finally {
      setLoadingGapEmployees(false);
    }
  };

  const openEditor = (skill: Skill | "new") => {
    setEditing(skill);
    setFormError(null);
    setForm(
      skill === "new"
        ? EMPTY_FORM
        : {
            skill_code: skill.skill_code,
            name: skill.name,
            skill_category: skill.skill_category,
            description: skill.description ?? "",
            display_order: skill.display_order,
            is_active: skill.is_active !== false,
          },
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = { ...form, description: form.description.trim() || null };
    try {
      if (editing === "new") await api.post("/skills", payload);
      else if (editing) await api.put(`/skills/${editing.id}`, payload);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not save the skill"));
    } finally {
      setSaving(false);
    }
  };

  const flip = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => ({
    onToggle: (v: string) => {
      set((cur) => toggled(cur, v));
      setPage(1);
    },
    onClear: () => {
      set(new Set());
      setPage(1);
    },
  });

  const withGaps = Object.values(gapBySkill).filter((g) => g.affected > 0).length;
  const mandatoryGaps = Object.values(gapBySkill).reduce((sum, g) => sum + g.mandatory, 0);

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
          <h1 className="text-[28px] font-semibold leading-tight text-ink">Skills</h1>
          <p className="text-[13.5px] text-ink-2">
            {isHr
              ? "The skills catalog, and where the workforce falls short of what roles require."
              : "The skills catalog, with your own proficiency where it has been assessed."}
          </p>
        </div>
        {isHr && (
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="rounded-lg border border-rule bg-panel px-3 py-2 text-[13px] font-medium text-ink hover:bg-sunken transition-colors inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4 text-ink-3" />
                <span>Export Skill Gaps</span>
              </button>

              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl border border-rule bg-panel py-1.5 shadow-xl animate-in fade-in">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      Export Format
                    </div>
                    <button
                      onClick={() => handleExportSkills("csv")}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink hover:bg-sunken"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      <span>Download CSV Matrix</span>
                    </button>
                    <button
                      onClick={() => handleExportSkills("pdf")}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink hover:bg-sunken"
                    >
                      <FileText className="h-4 w-4 text-rose-600" />
                      <span>Executive PDF Report</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button onClick={() => openEditor("new")} className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add Skill
            </button>
          </div>
        )}
      </div>

      {/* ── Top Row: 3 Bar Chart Stat Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Bar Chart 1: Skills Catalog Breakdown by Category */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#eef0ff", color: "#4f46e5" }}>
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink">{skills.length} Skills</p>
              <p className="text-[11px] text-ink-3">Catalog breakdown · click a bar to filter</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart
              data={[...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([category, count]) => ({ category, cat: category.length > 10 ? category.slice(0, 10) + "…" : category, count }))}
              margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
              barSize={14}
            >
              <XAxis dataKey="cat" tick={{ fontSize: 9, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--rule)" }}
                formatter={(v: any) => [v, "Skills"]}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} cursor="pointer" onClick={(entry: any) => {
                const category = entry?.payload?.category;
                if (category) { setQuery(""); setAvailability("all"); setCategories(new Set([category])); setGapsOnly(false); setNoGapsOnly(false); setPage(1); focusCatalog(); }
              }}>
                {[...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat], idx) => (
                  <Cell key={cat} fill={CATEGORY_HUES[idx % CATEGORY_HUES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart 2: Skills with Gaps vs No Gaps */}
        {isHr ? (
          <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#fdf0dc", color: "#d97706" }}>
                <TriangleAlert className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">{withGaps} / {skills.length}</p>
              <p className="text-[11px] text-ink-3">Skills with gaps · click a bar to filter</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart
                data={[
                  { label: "With Gaps", count: withGaps },
                  { label: "No Gaps", count: skills.length - withGaps },
                ]}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                barSize={28}
              >
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--rule)" }}
                  formatter={(v: any) => [v, "Skills"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry: any) => {
                  const hasGaps = entry?.payload?.label === "With Gaps";
                  if (entry?.payload?.label) { setQuery(""); setAvailability("all"); setCategories(new Set()); setGapsOnly(hasGaps); setNoGapsOnly(!hasGaps); setPage(1); focusCatalog(); }
                }}>
                  <Cell fill="#f59e0b" />
                  <Cell fill="#10b981" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#e5f7ef", color: "#059669" }}>
                <Cpu className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">{Object.keys(mine).length} held</p>
                <p className="text-[11px] text-ink-3">Your skill levels</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart
                data={[1, 2, 3, 4, 5].map(lvl => ({ level: `Lv ${lvl}`, count: Object.values(mine).filter(v => v === lvl).length }))}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                barSize={18}
              >
                <XAxis dataKey="level" tick={{ fontSize: 9, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--rule)" }} formatter={(v: any) => [v, "Skills"]} />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bar Chart 3: Mandatory Gaps Severity */}
        {isHr ? (
          <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#fde8e8", color: "#dc2626" }}>
                <Flag className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">{mandatoryGaps} Mandatory</p>
                <p className="text-[11px] text-ink-3">Gap severity by skill · click a bar for employees</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart
                data={topGaps.slice(0, 5).map(g => ({ skill_id: g.skill_id, skill_name: g.skill_name, name: g.skill_name.length > 10 ? g.skill_name.slice(0, 10) + "…" : g.skill_name, count: g.affected_employees_count }))}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                barSize={14}
              >
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 9, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--rule)" }}
                  formatter={(v: any) => [v, "Employees affected"]}
                />
                <Bar dataKey="count" fill="#dc2626" radius={[3, 3, 0, 0]} cursor="pointer" onClick={(entry: any) => {
                  const item = entry?.payload;
                  if (item?.skill_id) void showGapEmployees(item.skill_id, item.skill_name);
                }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                <Flag className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">{Object.values(mine).filter(v => v >= 4).length} Expert</p>
                <p className="text-[11px] text-ink-3">Level 4+ skills</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart
                data={["Expert(4+)", "Proficient(3)", "Developing(1-2)"].map((label, i) => ({
                  label,
                  count: i === 0
                    ? Object.values(mine).filter(v => v >= 4).length
                    : i === 1
                    ? Object.values(mine).filter(v => v === 3).length
                    : Object.values(mine).filter(v => v <= 2).length,
                }))}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                barSize={22}
              >
                <XAxis dataKey="label" tick={{ fontSize: 8.5, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--rule)" }} formatter={(v: any) => [v, "Skills"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  <Cell fill="#4f46e5" />
                  <Cell fill="#0891b2" />
                  <Cell fill="#94a3b8" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Filters and the gap ranking */}
        <div className="space-y-6">
          <aside className="card-raised space-y-4 p-5" aria-label="Filters">
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
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-3" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Name, code or category"
                aria-label="Search skills"
                className="field pl-9"
              />
            </div>
            <FacetGroup
              title="Category"
              allLabel="All Categories"
              total={skills.length}
              options={[...categoryCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([value, count]) => ({ value, label: value, count, dot: hueFor(value) }))}
              selected={categories}
              {...flip(setCategories)}
            />
            <fieldset className="border-t border-rule pt-4">
              <legend className="float-left mb-1 w-full text-[13px] font-semibold text-ink">Availability</legend>
              <div className="clear-both well flex p-0.5">
                {(["all", "active", "inactive"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setAvailability(v);
                      setPage(1);
                    }}
                    aria-pressed={availability === v}
                    className={`flex-1 rounded-md py-1.5 text-[13px] font-medium capitalize transition-colors ${
                      availability === v ? "bg-panel text-ink shadow-card" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>
            {isHr && (
              <label className="flex cursor-pointer items-center gap-2.5 border-t border-rule pt-4 text-[13px] text-ink-2">
                <input
                  type="checkbox"
                  checked={gapsOnly}
                  onChange={(e) => {
                    setGapsOnly(e.target.checked);
                    setNoGapsOnly(false);
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-rule-strong accent-[var(--accent)]"
                />
                Only skills with gaps
              </label>
            )}
          </aside>

          {isHr && topGaps.length > 0 && (
            <section className="card-raised p-5">
              <h2 className="text-[15px] font-semibold text-ink">Biggest gaps</h2>
              <p className="mb-4 text-[13px] text-ink-2">Employees below the role requirement.</p>
              <ol className="space-y-3">
                {topGaps.map((g, i) => (
                  <li key={g.skill_id}>
                    <div className="mb-1 flex items-center gap-2 text-[13px]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sunken text-[11px] font-semibold tabular-nums text-ink-2">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">{g.skill_name}</span>
                      <span className="tabular-nums text-ink-2">{g.affected_employees_count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="grow h-full rounded-full"
                        style={{
                          width: `${(g.affected_employees_count / maxAffected) * 100}%`,
                          background: "linear-gradient(90deg, var(--risk-medium), var(--risk-high))",
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Catalog */}
        <section id="skills-catalog" className="card-raised flex flex-col p-5 scroll-mt-6" aria-label="Skills catalog">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">
              Catalog <span className="ml-1 font-normal tabular-nums text-ink-3">{visible.length}</span>
            </h2>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="field w-auto"
                disabled={!isHr && sort === "gap"}
              >
                {SORTS.filter((s) => isHr || s.value !== "gap").map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {pageItems.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-3">No matching skills found in the catalog.</p>
          ) : (
            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((sk) => {
                const hue = hueFor(sk.skill_category);
                const gap = gapBySkill[sk.id];
                const level = mine[sk.id];
                const inactive = sk.is_active === false;
                return (
                  <article
                    key={sk.id}
                    className={`card-lift flex flex-col rounded-xl border border-rule bg-panel p-4 shadow-card ${inactive ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{
                          color: hue,
                          background: `color-mix(in srgb, ${hue} 12%, white)`,
                          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${hue} 25%, transparent)`,
                        }}
                      >
                        <Cpu className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-2">
                          {sk.skill_code}
                        </span>
                        {isHr && (
                          <button
                            onClick={() => openEditor(sk)}
                            aria-label={`Edit ${sk.name}`}
                            className="rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-3 text-[14.5px] font-semibold text-ink">{sk.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hue }} aria-hidden="true" />
                      {sk.skill_category}
                      {inactive && <span className="rounded-full bg-sunken px-1.5 text-[10.5px]">Inactive</span>}
                    </p>

                    <div className="mt-auto pt-4">
                      {isHr ? (
                        gap ? (
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 text-ink-2">
                                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="font-semibold tabular-nums text-ink">{gap.affected}</span> below target
                              </span>
                              <span className="tabular-nums text-ink-3">avg −{gap.avgGap.toFixed(1)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(gap.affected / maxAffected) * 100}%`,
                                  background: "linear-gradient(90deg, var(--risk-medium), var(--risk-high))",
                                }}
                              />
                            </div>
                            {gap.mandatory > 0 && (
                              <p className="mt-1.5 text-[11px] font-medium text-risk-critical">
                                {gap.mandatory} mandatory gap{gap.mandatory === 1 ? "" : "s"}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="border-t border-rule-soft pt-3 text-xs text-ink-3">No gaps reported</p>
                        )
                      ) : (
                        <div className="flex items-center justify-between border-t border-rule-soft pt-3 text-xs">
                          <span className="text-ink-2">Your level</span>
                          {level ? (
                            <span className="flex items-center gap-1" aria-label={`${level} out of 5`}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <span
                                  key={n}
                                  className="h-1.5 w-4 rounded-full"
                                  style={{ background: n <= level ? "var(--accent)" : "var(--rule)" }}
                                />
                              ))}
                            </span>
                          ) : (
                            <span className="text-ink-3">Not assessed</span>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-auto border-t border-rule-soft pt-4">
            <Pager page={currentPage} pageSize={PAGE_SIZE} total={visible.length} noun="skills" onPage={setPage} />
          </div>
        </section>
      </div>

      {selectedGapSkill && (
        <Modal
          wide
          title={`Employees with a ${selectedGapSkill.name} gap`}
          subtitle="Active employees whose current proficiency is below their role requirement."
          onClose={() => setSelectedGapSkill(null)}
        >
          {loadingGapEmployees ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-12" />)}
            </div>
          ) : gapEmployeesError ? (
            <p role="alert" className="py-6 text-center text-sm text-risk-critical">{gapEmployeesError}</p>
          ) : gapEmployees.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">No active employees currently have a gap for this skill.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-rule text-[11px] uppercase tracking-wide text-ink-3">
                  <tr><th className="py-2 pr-3">Employee</th><th className="py-2 pr-3">Department</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Current / required</th><th className="py-2">Gap</th></tr>
                </thead>
                <tbody className="divide-y divide-rule-soft">
                  {gapEmployees.map((employee) => (
                    <tr key={employee.employee_id}>
                      <td className="py-3 pr-3">
                        <Link to={`/employees/${employee.employee_id}`} onClick={() => setSelectedGapSkill(null)} className="font-medium text-link hover:underline">
                          {employee.employee_name}
                        </Link>
                        <span className="ml-2 text-xs text-ink-3">{employee.employee_code}</span>
                      </td>
                      <td className="py-3 pr-3 text-ink-2">{employee.department_name}</td>
                      <td className="py-3 pr-3 text-ink-2">{employee.job_role_title}</td>
                      <td className="py-3 pr-3 tabular-nums text-ink-2">{employee.current_proficiency} / {employee.required_proficiency}</td>
                      <td className="py-3 tabular-nums text-risk-high">-{employee.gap}{employee.mandatory ? " · Mandatory" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {editing && (
        <Modal
          title={editing === "new" ? "Add skill" : `Edit ${editing.name}`}
          subtitle="Skills can be required by job roles and taught by training courses."
          onClose={() => setEditing(null)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Skill code">
                <input
                  required
                  minLength={2}
                  maxLength={50}
                  className="field uppercase"
                  value={form.skill_code}
                  onChange={(e) => setForm({ ...form, skill_code: e.target.value })}
                  placeholder="PY-01"
                />
              </Field>
              <Field label="Name">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  className="field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Python"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  list="skill-categories"
                  className="field"
                  value={form.skill_category}
                  onChange={(e) => setForm({ ...form, skill_category: e.target.value })}
                />
                <datalist id="skill-categories">
                  {[...categoryCounts.keys()].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={3}
                className="field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Active in catalog
            </label>
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
                {saving ? "Saving..." : editing === "new" ? "Create skill" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
