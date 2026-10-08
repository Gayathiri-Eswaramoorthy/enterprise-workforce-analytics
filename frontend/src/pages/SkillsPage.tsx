import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { EmployeeSkill, Skill } from "../types";
import { Cpu, Flag, Layers, Pencil, Plus, Search, Tags, TriangleAlert, Users } from "lucide-react";
import { Kpi } from "../components/Kpi";
import { Field, Modal } from "../components/Modal";
import { FacetGroup, toggled } from "../components/FacetGroup";
import { Pager } from "../components/Pager";

const PAGE_SIZE = 9;

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
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Skill | "new" | null>(null);
  const [form, setForm] = useState<SkillForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
          (!gapsOnly || (gapBySkill[s.id]?.affected ?? 0) > 0),
      )
      .sort((a, b) => {
        if (sort === "gap") return (gapBySkill[b.id]?.affected ?? 0) - (gapBySkill[a.id]?.affected ?? 0);
        if (sort === "category")
          return a.skill_category.localeCompare(b.skill_category) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
  }, [skills, query, categories, availability, gapsOnly, sort, gapBySkill]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const maxAffected = Math.max(1, ...Object.values(gapBySkill).map((g) => g.affected));
  const filtersActive = query || categories.size > 0 || availability !== "all" || gapsOnly;

  const clearAll = () => {
    setQuery("");
    setCategories(new Set());
    setAvailability("all");
    setGapsOnly(false);
    setPage(1);
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
  const activeCount = skills.filter((s) => s.is_active !== false).length;

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
          <button onClick={() => openEditor("new")} className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add Skill
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Layers} label="Skills in catalog" value={skills.length} note={`${activeCount} active`} />
        <Kpi icon={Tags} label="Categories" value={categoryCounts.size} />
        {isHr ? (
          <>
            <Kpi icon={TriangleAlert} tone="var(--risk-medium)" label="Skills with gaps" value={withGaps} />
            <Kpi icon={Flag} tone="var(--risk-critical)" label="Mandatory gaps" value={mandatoryGaps} />
          </>
        ) : (
          <>
            <Kpi icon={Cpu} label="Skills you hold" value={Object.keys(mine).length} />
            <Kpi
              icon={Flag}
              tone="var(--risk-low)"
              label="Expert level (4+)"
              value={Object.values(mine).filter((v) => v >= 4).length}
            />
          </>
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
        <section className="card-raised flex flex-col p-5" aria-label="Skills catalog">
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
