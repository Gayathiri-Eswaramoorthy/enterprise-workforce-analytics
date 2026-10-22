import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { MyCourseProgress } from "../types";
import {
  Award,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  PlayCircle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

export const MyTrainingProgressPage: React.FC = () => {
  const { user } = useAuth();
  const employeeId = user?.employee_id ?? null;

  const [coursesProgress, setCoursesProgress] = useState<MyCourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    try {
      const progressRes = await api.get<MyCourseProgress[]>("/learning/my-courses");
      setCoursesProgress(progressRes.data || []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load training progress."));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[450px] w-full items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-medium text-ink-3">Loading course progress & quiz scores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
        <p className="font-medium">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const completedCount = coursesProgress.filter((c) => c.enrollment_status === "COMPLETED").length;
  const inProgressCount = coursesProgress.filter(
    (c) => c.enrollment_status !== "COMPLETED" && c.completed_lessons > 0
  ).length;
  const enrolledTotal = coursesProgress.length;
  const avgProgress =
    enrolledTotal > 0
      ? Math.round(
          coursesProgress.reduce((acc, c) => acc + Number(c.progress_percentage || 0), 0) / enrolledTotal
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">My Training Progress</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <GraduationCap className="h-3 w-3" />
              {completedCount} Completed
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-3">
            Track enrolled course lessons, interactive modules, knowledge check quizzes, and certificates.
          </p>
        </div>

        <Link
          to="/my-learning"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover self-start sm:self-auto"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Browse Course Catalog
        </Link>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Enrolled */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Enrolled Courses</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{enrolledTotal}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Voluntary enrollments</span>
            <span className="text-accent font-medium">{inProgressCount} active now</span>
          </div>
        </div>

        {/* Completed Courses */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Completed</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{completedCount}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Verified completion</span>
            <span className="text-emerald-600 font-medium">
              {completedCount > 0 ? "Certificates issued" : "In progress"}
            </span>
          </div>
        </div>

        {/* Average Progress */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Average Completion</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{avgProgress}%</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Curriculum progress</span>
            <span className="text-ink-2 font-medium">All courses</span>
          </div>
        </div>

        {/* Verified Quizzes */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Quizzes Passed</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {coursesProgress.filter((c) => c.quiz_passed).length}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Knowledge evaluations</span>
            <span className="text-emerald-600 font-medium">80%+ required</span>
          </div>
        </div>
      </div>

      {/* Courses Progress Cards */}
      <div className="rounded-xl border border-rule bg-panel p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Active Course Progress & Lesson Status</h2>
            <p className="text-xs text-ink-3">Detailed module completion and quiz outcomes for enrolled courses.</p>
          </div>
        </div>

        {coursesProgress.length === 0 ? (
          <div className="py-12 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-ink-3/40" />
            <p className="mt-2 text-sm font-medium text-ink">No courses currently enrolled.</p>
            <p className="text-xs text-ink-3 mt-1">Explore available voluntary courses in the catalog.</p>
            <Link
              to="/my-learning"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover"
            >
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {coursesProgress.map((cp) => {
              const isDone = cp.enrollment_status === "COMPLETED";
              return (
                <div
                  key={cp.course_id}
                  className="rounded-xl border border-rule bg-sunken p-4 transition-colors hover:border-rule-strong"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-medium text-ink-3">{cp.course_code}</span>
                        <h3 className="text-sm font-semibold text-ink">{cp.title}</h3>
                        {isDone ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            Completed
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            In Progress
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-3">
                        Lessons: {cp.completed_lessons} of {cp.total_lessons} completed
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {cp.quiz_available && (
                        <div className="text-right">
                          <p className="text-xs text-ink-3">Quiz Score</p>
                          <p className="text-xs font-semibold">
                            {cp.quiz_score !== null && cp.quiz_score !== undefined ? (
                              <span
                                className={
                                  cp.quiz_passed ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"
                                }
                              >
                                {Math.round(cp.quiz_score)}% {cp.quiz_passed ? "(Passed)" : "(Retake available)"}
                              </span>
                            ) : (
                              <span className="text-ink-3 font-normal">Not attempted</span>
                            )}
                          </p>
                        </div>
                      )}

                      <Link
                        to="/my-learning"
                        className="inline-flex items-center gap-1 rounded-lg bg-panel border border-rule px-3 py-1.5 text-xs font-semibold text-ink hover:bg-hover hover:border-rule-strong shadow-sm whitespace-nowrap"
                      >
                        <PlayCircle className="h-3.5 w-3.5 text-accent" />
                        {isDone ? "Review" : "Continue"}
                      </Link>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-ink-3 mb-1">
                      <span>Curriculum Completion</span>
                      <span className="font-semibold text-ink">
                        {Math.round(Number(cp.progress_percentage || 0))}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-rule overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isDone ? "bg-emerald-500" : "bg-accent"
                        }`}
                        style={{ width: `${Math.round(Number(cp.progress_percentage || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
