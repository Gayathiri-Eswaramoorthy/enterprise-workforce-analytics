import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type {
  DifficultyLevel,
  EmployeeListItem,
  EnrollmentStatus,
  Skill,
  SkillGapItem,
  TrainingCourse,
  TrainingEnrollment,
  TrainingMode,
} from "../types";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Pencil,
  Play,
  Plus,
  Search,
  Target,
  TrendingUp,
  UserPlus,
  X,
} from "lucide-react";
import { Kpi } from "../components/Kpi";
import { Field, Modal } from "../components/Modal";
import { Pager } from "../components/Pager";
import { ENROLLMENT_LABEL, ENROLLMENT_TONE, EnrollmentStatusBadge } from "../components/EnrollmentStatusBadge";

const CATALOG_PAGE_SIZE = 6;
const ENROLLMENT_PAGE_SIZE = 7;

const DIFFICULTIES: DifficultyLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
const MODES: TrainingMode[] = ["ONLINE", "CLASSROOM", "HYBRID", "SELF_PACED"];
const STATUSES: EnrollmentStatus[] = ["ENROLLED", "IN_PROGRESS", "COMPLETED", "FAILED", "DROPPED"];

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};
/** Difficulty is a label, not a status, so it avoids the risk colors. */
const DIFFICULTY_HUE: Record<DifficultyLevel, string> = {
  BEGINNER: "#0f766e",
  INTERMEDIATE: "#2563eb",
  ADVANCED: "#7c3aed",
  EXPERT: "#4338ca",
};
const MODE_LABEL: Record<TrainingMode, string> = {
  ONLINE: "Online",
  CLASSROOM: "Classroom",
  HYBRID: "Hybrid",
  SELF_PACED: "Self-paced",
};

type CourseSort = "popular" | "title" | "duration";

interface CourseForm {
  course_code: string;
  title: string;
  provider: string;
  duration_hours: number;
  difficulty_level: DifficultyLevel;
  training_mode: TrainingMode;
  description: string;
  is_active: boolean;
  target_skill_ids: string[];
}

const EMPTY_COURSE: CourseForm = {
  course_code: "",
  title: "",
  provider: "",
  duration_hours: 8,
  difficulty_level: "BEGINNER",
  training_mode: "ONLINE",
  description: "",
  is_active: true,
  target_skill_ids: [],
};

const today = () => new Date().toISOString().slice(0, 10);

export const TrainingPage: React.FC = () => {
  const { user } = useAuth();
  const isHr = user?.role === "HR_ADMIN" || user?.role === "HR_MANAGER";
  const isEmployee = user?.role === "EMPLOYEE";
  const ownEmployeeId = user?.employee_id ?? null;

  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [gaps, setGaps] = useState<{ skill_id: string; skill_name: string; count: number; detail?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Catalog filters
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyLevel | "">("");
  const [mode, setMode] = useState<TrainingMode | "">("");
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<CourseSort>("popular");
  const [catalogPage, setCatalogPage] = useState(1);

  // Enrollment table filters
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | "ALL">("ALL");
  const [enrollQuery, setEnrollQuery] = useState("");
  const [enrollPage, setEnrollPage] = useState(1);

  // Dialogs
  const [courseDialog, setCourseDialog] = useState<TrainingCourse | "new" | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(EMPTY_COURSE);
  const [enrollDialog, setEnrollDialog] = useState<TrainingCourse | null>(null);
  const [enrollEmployeeId, setEnrollEmployeeId] = useState("");
  const [updateDialog, setUpdateDialog] = useState<TrainingEnrollment | null>(null);
  const [updateForm, setUpdateForm] = useState({
    status: "ENROLLED" as EnrollmentStatus,
    score: "",
    certificate: false,
  });
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const flash = useCallback((tone: "ok" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [cRes, firstPage] = await Promise.all([
        api.get("/training/courses"),
        // Employees without a linked profile have no enrollments to list
        isEmployee && !ownEmployeeId
          ? Promise.resolve({ data: { items: [], total: 0 } })
          : api.get("/training/enrollments", { params: { page: 1, page_size: 100 } }),
      ]);
      setCourses(cRes.data);

      const all: TrainingEnrollment[] = [...firstPage.data.items];
      for (let p = 2; all.length < firstPage.data.total && p <= 10; p++) {
        const next = await api.get("/training/enrollments", { params: { page: p, page_size: 100 } });
        all.push(...next.data.items);
      }
      setEnrollments(all);
    } catch (err) {
      console.error("Failed to load training data", err);
    } finally {
      setLoading(false);
    }
  }, [isEmployee, ownEmployeeId]);

  // Supporting data: HR needs the skills and people lists plus org-wide gaps, employees need their own gaps
  const fetchSupport = useCallback(async () => {
    try {
      if (isHr) {
        const [sRes, gRes] = await Promise.all([
          api.get("/skills", { params: { active_only: true } }),
          api.get("/analytics/skill-gaps/top", { params: { limit: 6 } }),
        ]);
        setSkills(sRes.data);
        setGaps(
          gRes.data.map((g: { skill_id: string; skill_name: string; affected_employees_count: number }) => ({
            skill_id: g.skill_id,
            skill_name: g.skill_name,
            count: g.affected_employees_count,
          })),
        );
        const all: EmployeeListItem[] = [];
        for (let p = 1; p <= 20; p++) {
          const res = await api.get("/employees", { params: { page: p, page_size: 100 } });
          all.push(...res.data.items);
          if (all.length >= res.data.total || res.data.items.length === 0) break;
        }
        setEmployees(all);
      } else if (ownEmployeeId) {
        const res = await api.get(`/analytics/skill-gaps/employee/${ownEmployeeId}`);
        setGaps(
          (res.data.gaps as SkillGapItem[])
            .filter((g) => g.gap > 0)
            .sort((a, b) => b.gap - a.gap)
            .slice(0, 6)
            .map((g) => ({
              skill_id: g.skill_id,
              skill_name: g.skill_name,
              count: g.gap,
              detail: `${g.current_proficiency}/5 → ${g.required_proficiency}/5`,
            })),
        );
      }
    } catch (err) {
      console.error("Failed to load supporting training data", err);
    }
  }, [isHr, ownEmployeeId]);

  useEffect(() => {
    fetchData();
    fetchSupport();
  }, [fetchData, fetchSupport]);

  // Employee view: the enrollment (if any) the user holds for each course
  const myEnrollmentByCourse = useMemo(
    () =>
      new Map(
        enrollments
          .filter((e) => e.employee_id === ownEmployeeId && e.enrollment_status !== "DROPPED")
          .map((e) => [e.training_course_id, e]),
      ),
    [enrollments, ownEmployeeId],
  );

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const coursesForSkill = useCallback(
    (skillId: string) =>
      courses.filter((c) => c.is_active && c.training_skills?.some((ts) => ts.skill_id === skillId)).length,
    [courses],
  );

  const stats = useMemo(() => {
    const live = enrollments.filter((e) => e.enrollment_status !== "DROPPED");
    const completed = live.filter((e) => e.enrollment_status === "COMPLETED");
    const hours = completed.reduce(
      (sum, e) => sum + Number(courseById.get(e.training_course_id)?.duration_hours ?? 0),
      0,
    );
    return {
      activeCourses: courses.filter((c) => c.is_active).length,
      inFlight: live.filter((e) => e.enrollment_status === "ENROLLED" || e.enrollment_status === "IN_PROGRESS").length,
      inProgress: live.filter((e) => e.enrollment_status === "IN_PROGRESS").length,
      completed: completed.length,
      rate: live.length ? Math.round((completed.length / live.length) * 100) : 0,
      hours: Math.round(hours),
    };
  }, [courses, enrollments, courseById]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of enrollments) m[e.enrollment_status] = (m[e.enrollment_status] ?? 0) + 1;
    return m;
  }, [enrollments]);

  const visibleCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .filter(
        (c) =>
          (isHr || c.is_active) &&
          (!difficulty || c.difficulty_level === difficulty) &&
          (!mode || c.training_mode === mode) &&
          (!skillFilter || c.training_skills?.some((ts) => ts.skill_id === skillFilter)) &&
          (!q ||
            c.title.toLowerCase().includes(q) ||
            c.course_code.toLowerCase().includes(q) ||
            (c.provider ?? "").toLowerCase().includes(q) ||
            c.training_skills?.some((ts) => ts.skill?.name.toLowerCase().includes(q))),
      )
      .sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "duration") return Number(a.duration_hours) - Number(b.duration_hours);
        return (b.enrolled_count ?? 0) - (a.enrolled_count ?? 0) || a.title.localeCompare(b.title);
      });
  }, [courses, isHr, query, difficulty, mode, skillFilter, sort]);

  const catalogPages = Math.max(1, Math.ceil(visibleCourses.length / CATALOG_PAGE_SIZE));
  const catalogCurrent = Math.min(catalogPage, catalogPages);
  const catalogItems = visibleCourses.slice(
    (catalogCurrent - 1) * CATALOG_PAGE_SIZE,
    catalogCurrent * CATALOG_PAGE_SIZE,
  );

  const visibleEnrollments = useMemo(() => {
    const q = enrollQuery.trim().toLowerCase();
    return enrollments
      .filter(
        (e) =>
          (statusFilter === "ALL" || e.enrollment_status === statusFilter) &&
          (!q ||
            (e.employee_name ?? "").toLowerCase().includes(q) ||
            (e.employee_code ?? "").toLowerCase().includes(q) ||
            (e.course?.title ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => b.enrollment_date.localeCompare(a.enrollment_date));
  }, [enrollments, statusFilter, enrollQuery]);

  const enrollPages = Math.max(1, Math.ceil(visibleEnrollments.length / ENROLLMENT_PAGE_SIZE));
  const enrollCurrent = Math.min(enrollPage, enrollPages);
  const enrollItems = visibleEnrollments.slice(
    (enrollCurrent - 1) * ENROLLMENT_PAGE_SIZE,
    enrollCurrent * ENROLLMENT_PAGE_SIZE,
  );

  // ---- Actions ----
  const handleEnroll = async (courseId: string) => {
    if (!ownEmployeeId) return;
    setBusyId(courseId);
    try {
      await api.post("/training/enrollments", { employee_id: ownEmployeeId, training_course_id: courseId });
      await fetchData();
      flash("ok", "You are enrolled. Start the course whenever you are ready.");
    } catch (err) {
      flash("error", getErrorMessage(err, "Enrollment failed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleSetStatus = async (enrollmentId: string, status: EnrollmentStatus) => {
    setBusyId(enrollmentId);
    try {
      await api.put(`/training/enrollments/${enrollmentId}`, { enrollment_status: status });
      await fetchData();
      flash("ok", status === "DROPPED" ? "Course dropped." : "Course started.");
    } catch (err) {
      flash("error", getErrorMessage(err, "Could not update enrollment"));
    } finally {
      setBusyId(null);
    }
  };

  const openCourseDialog = (course: TrainingCourse | "new") => {
    setCourseDialog(course);
    setDialogError(null);
    setCourseForm(
      course === "new"
        ? EMPTY_COURSE
        : {
            course_code: course.course_code,
            title: course.title,
            provider: course.provider ?? "",
            duration_hours: Number(course.duration_hours),
            difficulty_level: course.difficulty_level,
            training_mode: course.training_mode,
            description: course.description ?? "",
            is_active: course.is_active,
            target_skill_ids: (course.training_skills ?? []).map((ts) => ts.skill_id),
          },
    );
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setDialogError(null);
    const payload = { ...courseForm, description: courseForm.description.trim() || null };
    try {
      if (courseDialog === "new") await api.post("/training/courses", payload);
      else if (courseDialog) await api.put(`/training/courses/${courseDialog.id}`, payload);
      setCourseDialog(null);
      await fetchData();
      flash("ok", courseDialog === "new" ? "Course added to the catalog." : "Course updated.");
    } catch (err) {
      setDialogError(getErrorMessage(err, "Could not save the course"));
    } finally {
      setSaving(false);
    }
  };

  const saveEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollDialog || !enrollEmployeeId) return;
    setSaving(true);
    setDialogError(null);
    try {
      await api.post("/training/enrollments", {
        employee_id: enrollEmployeeId,
        training_course_id: enrollDialog.id,
      });
      setEnrollDialog(null);
      await fetchData();
      flash("ok", "Employee enrolled.");
    } catch (err) {
      setDialogError(getErrorMessage(err, "Enrollment failed"));
    } finally {
      setSaving(false);
    }
  };

  const openUpdateDialog = (en: TrainingEnrollment) => {
    setUpdateDialog(en);
    setDialogError(null);
    setUpdateForm({
      status: en.enrollment_status,
      score: en.completion_score != null ? String(Number(en.completion_score)) : "",
      certificate: en.certificate_issued,
    });
  };

  const saveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateDialog) return;
    setSaving(true);
    setDialogError(null);
    const finished = updateForm.status === "COMPLETED" || updateForm.status === "FAILED";
    try {
      await api.put(`/training/enrollments/${updateDialog.id}`, {
        enrollment_status: updateForm.status,
        ...(finished && updateForm.score !== "" ? { completion_score: Number(updateForm.score) } : {}),
        ...(finished ? { completion_date: updateDialog.completion_date ?? today() } : {}),
        certificate_issued: updateForm.status === "COMPLETED" && updateForm.certificate,
      });
      setUpdateDialog(null);
      await fetchData();
      flash("ok", "Enrollment updated.");
    } catch (err) {
      setDialogError(getErrorMessage(err, "Could not update enrollment"));
    } finally {
      setSaving(false);
    }
  };

  const resetCatalogPage = () => setCatalogPage(1);
  const activeSkillName =
    gaps.find((g) => g.skill_id === skillFilter)?.skill_name ?? skills.find((s) => s.id === skillFilter)?.name;

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

  const errorBox = dialogError && (
    <p
      role="alert"
      className="rounded-lg px-3 py-2 text-[13px] text-risk-critical"
      style={{ background: "color-mix(in srgb, var(--risk-critical) 8%, transparent)" }}
    >
      {dialogError}
    </p>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-ink">Training</h1>
          <p className="text-[13.5px] text-ink-2">
            {isHr
              ? "Courses, enrollments and the skills they close."
              : "Browse courses, enroll, and track your own learning."}
          </p>
        </div>
        {isHr && (
          <button onClick={() => openCourseDialog("new")} className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add Course
          </button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg px-4 py-2.5 text-[13px] font-medium"
          style={{
            color: notice.tone === "ok" ? "#0b6b45" : "var(--risk-critical)",
            background: `color-mix(in srgb, ${notice.tone === "ok" ? "var(--risk-low)" : "var(--risk-critical)"} 12%, transparent)`,
          }}
        >
          {notice.text}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={BookOpen} label="Active courses" value={stats.activeCourses} />
        <Kpi
          icon={Play}
          tone="var(--risk-medium)"
          label={isHr ? "Learners in flight" : "In progress"}
          value={isHr ? stats.inFlight : stats.inProgress}
        />
        <Kpi
          icon={CheckCircle2}
          tone="var(--risk-low)"
          label={isHr ? "Completion rate" : "Completed"}
          value={isHr ? `${stats.rate}%` : stats.completed}
          note={isHr ? `${stats.completed} done` : undefined}
        />
        <Kpi icon={Clock} label="Learning hours completed" value={stats.hours} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Course catalog */}
        <section className="card-raised flex flex-col p-5 lg:col-span-8" aria-label="Course catalog">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="mr-auto whitespace-nowrap text-[15px] font-semibold text-ink">
              Course catalog <span className="ml-1 font-normal tabular-nums text-ink-3">{visibleCourses.length}</span>
            </h2>
            <div className="relative min-w-[160px] flex-1 sm:max-w-[190px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-3" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetCatalogPage();
                }}
                placeholder="Search courses"
                aria-label="Search courses"
                className="field pl-9"
              />
            </div>
            <select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value as DifficultyLevel | "");
                resetCatalogPage();
              }}
              aria-label="Difficulty"
              className="field w-auto"
            >
              <option value="">All levels</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL[d]}
                </option>
              ))}
            </select>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as TrainingMode | "");
                resetCatalogPage();
              }}
              aria-label="Delivery mode"
              className="field w-auto"
            >
              <option value="">All formats</option>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as CourseSort)}
              aria-label="Sort courses"
              className="field w-auto"
            >
              <option value="popular">Most enrolled</option>
              <option value="title">Title (A → Z)</option>
              <option value="duration">Shortest first</option>
            </select>
          </div>

          {skillFilter && (
            <div className="mb-4 flex items-center gap-2 text-[13px] text-ink-2">
              Teaching
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1.5 font-medium text-link">
                {activeSkillName ?? "selected skill"}
                <button
                  onClick={() => {
                    setSkillFilter(null);
                    resetCatalogPage();
                  }}
                  aria-label="Clear skill filter"
                  className="rounded-full p-0.5 hover:bg-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          )}

          {catalogItems.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-3">No courses match these filters.</p>
          ) : (
            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {catalogItems.map((c) => {
                const mine = myEnrollmentByCourse.get(c.id);
                const hue = DIFFICULTY_HUE[c.difficulty_level];
                const enrolled = c.enrolled_count ?? 0;
                const done = c.completed_count ?? 0;
                return (
                  <article
                    key={c.id}
                    className={`card-lift flex flex-col rounded-xl border border-rule bg-panel p-4 shadow-card ${
                      c.is_active ? "" : "opacity-70"
                    }`}
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
                        <GraduationCap className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!c.is_active && (
                          <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-3">
                            Inactive
                          </span>
                        )}
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ color: hue, background: `color-mix(in srgb, ${hue} 10%, transparent)` }}
                        >
                          {DIFFICULTY_LABEL[c.difficulty_level]}
                        </span>
                        {isHr && (
                          <button
                            onClick={() => openCourseDialog(c)}
                            aria-label={`Edit ${c.title}`}
                            className="rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-3 text-[14.5px] font-semibold leading-snug text-ink">{c.title}</h3>
                    <p className="mt-1 line-clamp-2 min-h-[2.4rem] text-[12.5px] text-ink-2">
                      {c.description || "Upskilling course."}
                    </p>

                    <div className="mt-2 flex min-h-[1.5rem] flex-wrap gap-1.5">
                      {(c.training_skills ?? []).slice(0, 3).map((ts) => (
                        <button
                          key={ts.id}
                          onClick={() => {
                            setSkillFilter(ts.skill_id);
                            resetCatalogPage();
                          }}
                          className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-accent-soft hover:text-link"
                        >
                          {ts.skill?.name}
                        </button>
                      ))}
                      {(c.training_skills?.length ?? 0) > 3 && (
                        <span className="px-1 py-0.5 text-[11px] text-ink-3">
                          +{(c.training_skills?.length ?? 0) - 3}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-rule-soft pt-3 text-xs text-ink-2">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                        {Number(c.duration_hours)} h · {MODE_LABEL[c.training_mode]}
                      </span>
                      <span className="truncate pl-2 text-ink-3">{c.provider}</span>
                    </div>

                    {isHr && (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[11px] text-ink-3">
                          <span>
                            <span className="font-semibold tabular-nums text-ink">{enrolled}</span> enrolled
                          </span>
                          <span>
                            <span className="font-semibold tabular-nums text-ink">{done}</span> completed
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${enrolled ? (done / enrolled) * 100 : 0}%`,
                              background: "linear-gradient(90deg, var(--accent), #5b8ef0)",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pt-4">
                      {isHr ? (
                        <button
                          onClick={() => {
                            setEnrollDialog(c);
                            setEnrollEmployeeId("");
                            setDialogError(null);
                          }}
                          disabled={!c.is_active}
                          className="btn h-8 w-full text-[13px]"
                        >
                          <UserPlus className="h-4 w-4" aria-hidden="true" /> Enroll employee
                        </button>
                      ) : mine ? (
                        <div className="flex items-center justify-between">
                          <EnrollmentStatusBadge status={mine.enrollment_status} />
                          {mine.enrollment_status === "ENROLLED" && (
                            <button
                              onClick={() => handleSetStatus(mine.id, "IN_PROGRESS")}
                              disabled={busyId === mine.id}
                              className="btn h-8 text-[13px]"
                            >
                              <Play className="h-3.5 w-3.5" aria-hidden="true" /> Start
                            </button>
                          )}
                        </div>
                      ) : ownEmployeeId ? (
                        <button
                          onClick={() => handleEnroll(c.id)}
                          disabled={busyId === c.id || !c.is_active}
                          className="btn btn-primary h-8 w-full text-[13px]"
                        >
                          {busyId === c.id ? "Enrolling..." : "Enroll"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-auto border-t border-rule-soft pt-4">
            <Pager
              page={catalogCurrent}
              pageSize={CATALOG_PAGE_SIZE}
              total={visibleCourses.length}
              noun="courses"
              onPage={setCatalogPage}
            />
          </div>
        </section>

        {/* Right rail */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          <section className="card-raised p-5">
            <h2 className="text-[15px] font-semibold text-ink">{isHr ? "Learning progress" : "My learning"}</h2>
            <p className="mb-4 text-[13px] text-ink-2">Enrollments by status.</p>
            {enrollments.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-3">No enrollments yet.</p>
            ) : (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken">
                  {STATUSES.map((s) =>
                    statusCounts[s] ? (
                      <span
                        key={s}
                        style={{
                          width: `${(statusCounts[s] / enrollments.length) * 100}%`,
                          background: ENROLLMENT_TONE[s],
                        }}
                        title={`${ENROLLMENT_LABEL[s]}: ${statusCounts[s]}`}
                      />
                    ) : null,
                  )}
                </div>
                <ul className="mt-4 space-y-2">
                  {STATUSES.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-[13px]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: ENROLLMENT_TONE[s] }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-ink-2">{ENROLLMENT_LABEL[s]}</span>
                      <span className="font-semibold tabular-nums text-ink">{statusCounts[s] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card-raised flex flex-col p-5 lg:flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Target className="h-4 w-4 text-link" aria-hidden="true" />
              <h2 className="text-[15px] font-semibold text-ink">{isHr ? "Skills to close" : "Recommended for you"}</h2>
            </div>
            <p className="mb-4 text-[13px] text-ink-2">
              {isHr
                ? "Biggest gaps, and whether a course teaches them."
                : "Your gaps against your role. Select one to see matching courses."}
            </p>
            {gaps.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-3">No skill gaps to close.</p>
            ) : (
              <ul className="flex flex-1 flex-col divide-y divide-rule-soft">
                {gaps.map((g) => {
                  const n = coursesForSkill(g.skill_id);
                  const active = skillFilter === g.skill_id;
                  return (
                    <li key={g.skill_id} className="flex flex-1 items-stretch py-1">
                      <button
                        onClick={() => {
                          setSkillFilter(active ? null : g.skill_id);
                          resetCatalogPage();
                        }}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 text-left transition-colors ${
                          active ? "border-accent bg-accent-soft" : "border-transparent hover:bg-hover"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">{g.skill_name}</span>
                          <span className="block text-xs text-ink-3">
                            {isHr ? `${g.count} employee${g.count === 1 ? "" : "s"} below target` : g.detail}
                          </span>
                        </span>
                        <span
                          className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={
                            n > 0
                              ? { color: "var(--link)", background: "var(--accent-soft)" }
                              : {
                                  color: "#8a5a00",
                                  background: "color-mix(in srgb, var(--risk-medium) 18%, transparent)",
                                }
                          }
                        >
                          {n > 0 ? `${n} course${n === 1 ? "" : "s"}` : "No course"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Enrollments */}
      <section className="card-raised p-5" aria-label="Enrollments">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{isEmployee ? "My enrollments" : "Enrollments"}</h2>
            <p className="text-[13px] text-ink-2">
              {isHr ? "Track progress and record results." : "Courses you have joined and where you stand."}
            </p>
          </div>
          {!isEmployee && (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-3" aria-hidden="true" />
              <input
                type="search"
                value={enrollQuery}
                onChange={(e) => {
                  setEnrollQuery(e.target.value);
                  setEnrollPage(1);
                }}
                placeholder="Search employee or course"
                aria-label="Search enrollments"
                className="field pl-9"
              />
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {(["ALL", ...STATUSES] as const).map((s) => {
            const count = s === "ALL" ? enrollments.length : (statusCounts[s] ?? 0);
            const on = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setEnrollPage(1);
                }}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                  on
                    ? "border-accent bg-accent-soft text-link"
                    : "border-rule-strong bg-panel text-ink-2 hover:bg-hover"
                }`}
              >
                {s === "ALL" ? "All" : ENROLLMENT_LABEL[s]}{" "}
                <span className="ml-1 tabular-nums text-ink-3">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-[13px] text-ink">
            <colgroup>
              {!isEmployee && <col style={{ width: "22%" }} />}
              <col />
              <col style={{ width: 120 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead className="border-b border-rule bg-sunken text-xs font-semibold text-ink-2">
              <tr>
                {!isEmployee && <th className="px-4 py-3">Employee</th>}
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Score</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-soft">
              {enrollItems.length === 0 && (
                <tr>
                  <td colSpan={isEmployee ? 5 : 6} className="py-12 text-center text-sm text-ink-3">
                    No enrollments to show{isEmployee ? " - enroll in a course from the catalog." : "."}
                  </td>
                </tr>
              )}
              {enrollItems.map((en) => (
                <tr key={en.id} className="hover:bg-hover">
                  {!isEmployee && (
                    <td className="px-4 py-3">
                      <span className="block truncate font-medium text-ink">{en.employee_name || "—"}</span>
                      <span className="text-xs text-ink-3">{en.employee_code}</span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="block truncate">{en.course?.title || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-ink-2">
                    {new Date(en.enrollment_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <EnrollmentStatusBadge status={en.enrollment_status} />
                  </td>
                  <td className="px-4 py-3 text-center font-semibold tabular-nums">
                    {en.completion_score != null ? (
                      `${Number(en.completion_score)}%`
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      {isHr ? (
                        <button onClick={() => openUpdateDialog(en)} className="btn h-8 text-[13px]">
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Update
                        </button>
                      ) : (
                        <>
                          {en.enrollment_status === "ENROLLED" && (
                            <button
                              onClick={() => handleSetStatus(en.id, "IN_PROGRESS")}
                              disabled={busyId === en.id}
                              className="btn h-8 text-[13px]"
                            >
                              Start
                            </button>
                          )}
                          {(en.enrollment_status === "ENROLLED" || en.enrollment_status === "IN_PROGRESS") && (
                            <button
                              onClick={() => handleSetStatus(en.id, "DROPPED")}
                              disabled={busyId === en.id}
                              className="btn h-8 text-[13px]"
                            >
                              Drop
                            </button>
                          )}
                          {en.enrollment_status === "COMPLETED" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-2">
                              <TrendingUp className="h-3.5 w-3.5 text-risk-low" aria-hidden="true" /> Done
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border-t border-rule-soft pt-4">
          <Pager
            page={enrollCurrent}
            pageSize={ENROLLMENT_PAGE_SIZE}
            total={visibleEnrollments.length}
            noun="enrollments"
            onPage={setEnrollPage}
          />
        </div>
      </section>

      {/* Add / edit course */}
      {courseDialog && (
        <Modal
          wide
          title={courseDialog === "new" ? "Add course" : `Edit ${courseDialog.title}`}
          subtitle="Courses appear in the catalog and can target one or more skills."
          onClose={() => setCourseDialog(null)}
        >
          <form onSubmit={saveCourse} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Course code">
                <input
                  required
                  minLength={2}
                  className="field uppercase"
                  value={courseForm.course_code}
                  onChange={(e) => setCourseForm({ ...courseForm, course_code: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Title">
                  <input
                    required
                    minLength={2}
                    className="field"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="col-span-2">
                <Field label="Provider">
                  <input
                    required
                    minLength={2}
                    className="field"
                    value={courseForm.provider}
                    onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Hours">
                <input
                  type="number"
                  required
                  min={0.5}
                  max={1000}
                  step={0.5}
                  className="field"
                  value={courseForm.duration_hours}
                  onChange={(e) => setCourseForm({ ...courseForm, duration_hours: Number(e.target.value) })}
                />
              </Field>
              <Field label="Level">
                <select
                  className="field"
                  value={courseForm.difficulty_level}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, difficulty_level: e.target.value as DifficultyLevel })
                  }
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABEL[d]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Format">
                <select
                  className="field"
                  value={courseForm.training_mode}
                  onChange={(e) => setCourseForm({ ...courseForm, training_mode: e.target.value as TrainingMode })}
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-end gap-2 pb-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={courseForm.is_active}
                  onChange={(e) => setCourseForm({ ...courseForm, is_active: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Open for enrollment
              </label>
            </div>
            <Field label="Description">
              <textarea
                rows={3}
                className="field"
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              />
            </Field>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-ink-2">Skills taught</legend>
              <div className="well flex max-h-32 flex-wrap gap-1.5 overflow-y-auto p-2">
                {skills.map((s) => {
                  const on = courseForm.target_skill_ids.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      aria-pressed={on}
                      onClick={() =>
                        setCourseForm({
                          ...courseForm,
                          target_skill_ids: on
                            ? courseForm.target_skill_ids.filter((id) => id !== s.id)
                            : [...courseForm.target_skill_ids, s.id],
                        })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        on
                          ? "border-accent bg-accent text-white"
                          : "border-rule-strong bg-panel text-ink-2 hover:bg-hover"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {errorBox}
            <div className="flex justify-end gap-3 border-t border-rule-soft pt-4">
              <button type="button" onClick={() => setCourseDialog(null)} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : courseDialog === "new" ? "Create course" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* HR: enroll an employee */}
      {enrollDialog && (
        <Modal title="Enroll employee" subtitle={enrollDialog.title} onClose={() => setEnrollDialog(null)}>
          <form onSubmit={saveEnrollment} className="space-y-4">
            <Field label="Employee">
              <select
                required
                className="field"
                value={enrollEmployeeId}
                onChange={(e) => setEnrollEmployeeId(e.target.value)}
              >
                <option value="">Select an employee…</option>
                {[...employees]
                  .filter((e) => !e.is_deleted && e.employment_status === "ACTIVE")
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} · {e.department_name}
                    </option>
                  ))}
              </select>
            </Field>
            {errorBox}
            <div className="flex justify-end gap-3 border-t border-rule-soft pt-4">
              <button type="button" onClick={() => setEnrollDialog(null)} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={saving || !enrollEmployeeId} className="btn btn-primary">
                {saving ? "Enrolling..." : "Enroll"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* HR: record progress */}
      {updateDialog && (
        <Modal
          title="Update enrollment"
          subtitle={`${updateDialog.employee_name ?? "Employee"} · ${updateDialog.course?.title ?? ""}`}
          onClose={() => setUpdateDialog(null)}
        >
          <form onSubmit={saveUpdate} className="space-y-4">
            <Field label="Status">
              <select
                className="field"
                value={updateForm.status}
                onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value as EnrollmentStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ENROLLMENT_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            {(updateForm.status === "COMPLETED" || updateForm.status === "FAILED") && (
              <Field label="Score (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="field"
                  value={updateForm.score}
                  onChange={(e) => setUpdateForm({ ...updateForm, score: e.target.value })}
                />
              </Field>
            )}
            {updateForm.status === "COMPLETED" && (
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={updateForm.certificate}
                  onChange={(e) => setUpdateForm({ ...updateForm, certificate: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Certificate issued
              </label>
            )}
            {errorBox}
            <div className="flex justify-end gap-3 border-t border-rule-soft pt-4">
              <button type="button" onClick={() => setUpdateDialog(null)} className="btn">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
