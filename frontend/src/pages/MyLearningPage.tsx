import React, { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../services/api";
import type {
  CourseLesson,
  CourseQuiz,
  MyCourseProgress,
  QuizAttempt,
  SkillAssessmentComparison,
} from "../types";
import {
  Award,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  GraduationCap,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Video,
} from "lucide-react";
import { Kpi } from "../components/Kpi";
import { Modal } from "../components/Modal";
import { EnrollmentStatusBadge } from "../components/EnrollmentStatusBadge";

function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const v = parsed.pathname.replace(/^\//, "");
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
    }
  } catch {
    return null;
  }
  return null;
}

export const MyLearningPage: React.FC = () => {
  const [courses, setCourses] = useState<MyCourseProgress[]>([]);
  const [assessments, setAssessments] = useState<SkillAssessmentComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active course / lesson player state
  const [activeCourse, setActiveCourse] = useState<MyCourseProgress | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [activeLessonIndex, setActiveLessonIndex] = useState<number>(0);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [completingLessonId, setCompletingLessonId] = useState<string | null>(null);
  const [openingResourceId, setOpeningResourceId] = useState<string | null>(null);

  // Quiz modal state
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizData, setQuizData] = useState<CourseQuiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [latestAttempt, setLatestAttempt] = useState<QuizAttempt | null>(null);
  const [attemptsHistory, setAttemptsHistory] = useState<QuizAttempt[]>([]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"courses" | "assessments">("courses");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [coursesRes, assessRes] = await Promise.all([
        api.get<MyCourseProgress[]>("/learning/my-courses"),
        api.get<SkillAssessmentComparison[]>("/learning/assessments/my"),
      ]);
      setCourses(coursesRes.data);
      setAssessments(assessRes.data);
      // Sync active course if one is open so progress and status update immediately
      setActiveCourse((current) => {
        if (!current) return null;
        const updated = coursesRes.data.find((c) => c.course_id === current.course_id);
        return updated ?? current;
      });
    } catch (err) {
      setError(getErrorMessage(err, "Could not load learning records"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadCourseLessons = async (course: MyCourseProgress) => {
    setActiveCourse(course);
    setLessonsLoading(true);
    try {
      const res = await api.get<CourseLesson[]>(`/learning/courses/${course.course_id}/lessons`);
      setLessons(res.data);
      // Auto select first incomplete lesson or first lesson
      const firstIncomplete = res.data.findIndex((l) => !l.is_completed);
      setActiveLessonIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load course lessons"));
    } finally {
      setLessonsLoading(false);
    }
  };

  const handleOpenResource = async (lesson: CourseLesson) => {
    if (!lesson.external_url) return;
    setOpeningResourceId(lesson.id);
    try {
      const res = await api.post<CourseLesson>(`/learning/lessons/${lesson.id}/open`);
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lesson.id
            ? { ...l, resource_opened: true, opened_at: res.data.opened_at }
            : l
        )
      );
    } catch (err) {
      console.warn("Could not record resource open status", err);
    } finally {
      setOpeningResourceId(null);
    }
    // Safely open external resource in a new tab
    window.open(lesson.external_url, "_blank", "noopener,noreferrer");
  };

  const handleCompleteLesson = async (lessonId: string) => {
    setCompletingLessonId(lessonId);
    try {
      const res = await api.post<CourseLesson>(`/learning/lessons/${lessonId}/complete`);
      // Update lesson in local state
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId
            ? {
                ...l,
                is_completed: true,
                completed_at: res.data.completed_at,
                resource_opened: true,
              }
            : l
        )
      );
      // Refresh course progress overview
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not mark lesson complete"));
    } finally {
      setCompletingLessonId(null);
    }
  };

  const openQuiz = async (course: MyCourseProgress) => {
    setQuizModalOpen(true);
    setQuizLoading(true);
    setLatestAttempt(null);
    setSelectedAnswers({});
    try {
      const [quizRes, attemptsRes] = await Promise.all([
        api.get<CourseQuiz>(`/learning/courses/${course.course_id}/quiz`),
        api.get<QuizAttempt[]>(`/learning/courses/${course.course_id}/quiz/attempts`),
      ]);
      setQuizData(quizRes.data);
      setAttemptsHistory(attemptsRes.data);
      if (attemptsRes.data.length > 0) {
        setLatestAttempt(attemptsRes.data[0]);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not load quiz questions"));
    } finally {
      setQuizLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeCourse || !quizData) return;
    const answersPayload = Object.entries(selectedAnswers).map(
      ([question_id, selected_option_id]) => ({
        question_id,
        selected_option_id,
      })
    );

    setSubmittingQuiz(true);
    try {
      const res = await api.post<QuizAttempt>(
        `/learning/courses/${activeCourse.course_id}/quiz/submit`,
        {
          answers: answersPayload,
        }
      );
      setLatestAttempt(res.data);
      setAttemptsHistory((prev) => [res.data, ...prev]);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Quiz submission failed"));
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const activeLesson = lessons[activeLessonIndex];

  // Calculated Stats
  const enrolledCount = courses.length;
  const completedCount = courses.filter((c) => c.enrollment_status === "COMPLETED").length;
  const inProgressCount = courses.filter((c) => c.enrollment_status === "IN_PROGRESS").length;
  const overallCompletionRate =
    enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
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
          <h1 className="text-[28px] font-semibold leading-tight text-ink">My Learning</h1>
          <p className="text-[13.5px] text-ink-2">
            Study curated external video tutorials, read in-app key concepts, take domain quizzes, and track your verified skill growth.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("courses")}
            className={`rounded-lg px-4 py-2 text-[13.5px] font-medium transition-colors ${
              activeTab === "courses"
                ? "bg-accent-soft text-link border border-accent"
                : "bg-panel text-ink-2 border border-rule-strong hover:bg-hover"
            }`}
          >
            <BookOpen className="inline-block mr-1.5 h-4 w-4" /> Courses & Lessons
          </button>
          <button
            onClick={() => setActiveTab("assessments")}
            className={`rounded-lg px-4 py-2 text-[13.5px] font-medium transition-colors ${
              activeTab === "assessments"
                ? "bg-accent-soft text-link border border-accent"
                : "bg-panel text-ink-2 border border-rule-strong hover:bg-hover"
            }`}
          >
            <Sparkles className="inline-block mr-1.5 h-4 w-4" /> Skill Growth & Before-After
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg p-3 text-[13px] text-risk-critical"
          style={{ background: "color-mix(in srgb, var(--risk-critical) 8%, transparent)" }}
        >
          {error}
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={GraduationCap} label="Enrolled Courses" value={enrolledCount} />
        <Kpi
          icon={Play}
          tone="var(--risk-medium)"
          label="Courses in Progress"
          value={inProgressCount}
        />
        <Kpi
          icon={CheckCircle2}
          tone="var(--risk-low)"
          label="Completed Courses"
          value={completedCount}
          note={`${overallCompletionRate}% completion rate`}
        />
        <Kpi
          icon={Award}
          label="Skills Assessed"
          value={assessments.length}
          note={`${assessments.filter((a) => a.is_improved).length} improved`}
        />
      </div>

      {/* Main Content Area */}
      {activeTab === "courses" ? (
        activeCourse ? (
          /* Lesson Viewer / Course Player */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Lesson Player */}
            <div className="card-raised flex flex-col p-6 lg:col-span-8">
              <div className="mb-4 flex items-center justify-between border-b border-rule-soft pb-4">
                <button
                  onClick={() => setActiveCourse(null)}
                  className="flex items-center text-[13px] font-medium text-ink-2 hover:text-ink transition-colors"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back to My Courses
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                    {activeCourse.course_code}
                  </span>
                  <EnrollmentStatusBadge status={activeCourse.enrollment_status} />
                </div>
              </div>

              {lessonsLoading ? (
                <div className="space-y-4 py-12">
                  <div className="skeleton h-8 w-3/4" />
                  <div className="skeleton h-32" />
                  <div className="skeleton h-32" />
                </div>
              ) : activeLesson ? (
                <div className="flex flex-col flex-1">
                  {/* Lesson Header */}
                  <div className="mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-link">
                        Resource {activeLesson.order_index} of {lessons.length}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status badge */}
                        {activeLesson.is_completed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                            <CheckCircle className="h-3 w-3" /> Completed
                          </span>
                        ) : activeLesson.resource_opened ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                            <Eye className="h-3 w-3" /> Resource Opened
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 bg-sunken px-2.5 py-0.5 rounded-full border border-rule-soft">
                            Not Started
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-xs text-ink-2 bg-sunken px-2.5 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" />
                          {activeLesson.estimated_minutes} min
                        </span>
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-ink mb-2">{activeLesson.title}</h2>

                    {/* Meta Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      {activeLesson.skill_covered && (
                        <span className="rounded bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-link border border-accent/20">
                          Skill: {activeLesson.skill_covered}
                        </span>
                      )}
                      <span className="rounded bg-panel px-2.5 py-0.5 text-[11px] font-medium text-ink-2 border border-rule-strong">
                        Provider: {activeLesson.provider}
                      </span>
                      <span className="rounded bg-panel px-2.5 py-0.5 text-[11px] font-medium text-ink-2 border border-rule-strong uppercase">
                        {activeLesson.resource_type}
                      </span>
                      {activeLesson.access_type === "FREE" && (
                        <span className="rounded bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-800 border border-green-200">
                          Free Access
                        </span>
                      )}
                      {activeLesson.access_type === "PAID" && (
                        <span className="rounded bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                          Paid Course (External Account Required)
                        </span>
                      )}
                      {activeLesson.access_type === "ACCOUNT_REQUIRED" && (
                        <span className="rounded bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800 border border-blue-200">
                          Account Required
                        </span>
                      )}
                    </div>

                    {activeLesson.description && (
                      <p className="mt-3 text-xs text-ink-2 bg-sunken p-3 rounded-lg border border-rule-soft">
                        {activeLesson.description}
                      </p>
                    )}
                  </div>

                  {/* External Resource Player / Card */}
                  {activeLesson.external_url && (
                    <div className="mb-6 rounded-xl border border-rule-soft bg-panel p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {activeLesson.resource_type === "VIDEO" ? (
                            <Video className="h-4 w-4 text-accent" />
                          ) : activeLesson.resource_type === "COURSE" ? (
                            <GraduationCap className="h-4 w-4 text-accent" />
                          ) : (
                            <BookOpen className="h-4 w-4 text-accent" />
                          )}
                          <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                            External Learning Resource ({activeLesson.provider})
                          </h3>
                        </div>
                        <button
                          onClick={() => handleOpenResource(activeLesson)}
                          disabled={openingResourceId === activeLesson.id}
                          className="btn btn-secondary h-8 px-3 text-xs font-medium"
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Open in New Tab
                        </button>
                      </div>

                      {/* YouTube Player or External Course Notice */}
                      {getYouTubeEmbedUrl(activeLesson.external_url) ? (
                        <div>
                          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                            <iframe
                              src={getYouTubeEmbedUrl(activeLesson.external_url)!}
                              title={activeLesson.title}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                          <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-3">
                            <span>
                              Note: If video embedding is restricted by your browser or network, open directly on YouTube.
                            </span>
                            <button
                              onClick={() => handleOpenResource(activeLesson)}
                              className="text-link hover:underline font-medium inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" /> Watch on YouTube
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-sunken p-4 border border-rule-soft">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-semibold text-ink">
                                Hosted on {activeLesson.provider}
                              </p>
                              <p className="text-[12px] text-ink-2 mt-1">
                                {activeLesson.access_type === "PAID"
                                  ? "This is a paid external course. You can study the curriculum via your personal or enterprise Udemy account. In-app notes and key concepts are provided below."
                                  : "This official documentation resource is hosted externally. Click below to view the full interactive reference material in a safe new tab."}
                              </p>
                              {activeLesson.resource_opened && (
                                <p className="text-[11px] text-blue-700 mt-2 font-medium flex items-center gap-1">
                                  <Eye className="h-3 w-3" /> Resource accessed on{" "}
                                  {activeLesson.opened_at
                                    ? new Date(activeLesson.opened_at).toLocaleDateString()
                                    : "recently"}
                                  .
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleOpenResource(activeLesson)}
                              className="btn btn-primary h-9 px-4 text-xs shrink-0"
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Open {activeLesson.provider}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Formatted In-App Content / Summary */}
                  <div className="mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3 mb-2 flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" /> In-App Learning Summary & Key Concepts
                    </h3>
                  </div>

                  <div className="prose prose-sm max-w-none flex-1 rounded-xl bg-sunken p-6 border border-rule-soft overflow-y-auto max-h-[500px] text-ink">
                    <div
                      className="lesson-content whitespace-pre-wrap leading-relaxed text-[14px]"
                      dangerouslySetInnerHTML={{
                        __html: activeLesson.content
                          .replace(
                            /^# (.*$)/gim,
                            '<h1 class="text-xl font-bold text-ink mb-3 pb-1 border-b border-rule">$1</h1>'
                          )
                          .replace(
                            /^## (.*$)/gim,
                            '<h2 class="text-base font-semibold text-ink mt-4 mb-2">$1</h2>'
                          )
                          .replace(
                            /```python([\s\S]*?)```/gim,
                            '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg my-3 overflow-x-auto font-mono text-xs"><code>$1</code></pre>'
                          )
                          .replace(
                            /```sql([\s\S]*?)```/gim,
                            '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg my-3 overflow-x-auto font-mono text-xs"><code>$1</code></pre>'
                          )
                          .replace(
                            /```dockerfile([\s\S]*?)```/gim,
                            '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg my-3 overflow-x-auto font-mono text-xs"><code>$1</code></pre>'
                          ),
                      }}
                    />
                  </div>

                  {/* Lesson Action Controls */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule-soft pt-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveLessonIndex((prev) => Math.max(0, prev - 1))}
                        disabled={activeLessonIndex === 0}
                        className="btn h-9 text-xs"
                      >
                        <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                      </button>
                      <button
                        onClick={() =>
                          setActiveLessonIndex((prev) => Math.min(lessons.length - 1, prev + 1))
                        }
                        disabled={activeLessonIndex === lessons.length - 1}
                        className="btn h-9 text-xs"
                      >
                        Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {activeLesson.external_url && !activeLesson.resource_opened && (
                        <button
                          onClick={() => handleOpenResource(activeLesson)}
                          className="btn btn-secondary h-9 text-xs"
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open External Resource
                        </button>
                      )}

                      {activeLesson.is_completed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                          <CheckCircle className="h-4 w-4" /> Lesson Completed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCompleteLesson(activeLesson.id)}
                          disabled={completingLessonId === activeLesson.id}
                          className="btn btn-primary h-9 text-xs"
                        >
                          {completingLessonId === activeLesson.id ? (
                            "Saving Progress..."
                          ) : (
                            <>
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Lesson Complete
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-ink-3">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-ink-3 opacity-60" />
                  <p className="text-base font-semibold text-ink">
                    No lessons published yet for this course.
                  </p>
                  <p className="text-xs text-ink-2 mt-1">
                    Course resources are being prepared by the curriculum administrators.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Course Table of Contents & Knowledge Quiz */}
            <div className="flex flex-col gap-6 lg:col-span-4">
              {/* Progress Summary Card */}
              <div className="card-raised p-5">
                <h3 className="text-sm font-semibold text-ink">Course Completion Status</h3>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-2">
                  <span>
                    Progress ({activeCourse.completed_lessons} of {activeCourse.total_lessons} lessons)
                  </span>
                  <span className="font-bold tabular-nums text-ink">
                    {Math.round(Number(activeCourse.progress_percentage || 0))}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(Number(activeCourse.progress_percentage || 0)))}%` }}
                  />
                </div>

                {/* Course Quiz Trigger */}
                <div className="mt-5 border-t border-rule-soft pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-ink">Certification Quiz</h4>
                      <p className="text-[11px] text-ink-3">
                        {activeCourse.quiz_available
                          ? "70% passing threshold required"
                          : "Assessment not available yet"}
                      </p>
                    </div>
                    {activeCourse.quiz_passed ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-800">
                        Passed ({Math.round(Number(activeCourse.quiz_score || 0))}%)
                      </span>
                    ) : activeCourse.quiz_available ? (
                      <button
                        onClick={() => openQuiz(activeCourse)}
                        className="btn btn-primary h-8 text-xs"
                      >
                        <HelpCircle className="mr-1 h-3.5 w-3.5" /> Take Quiz
                      </button>
                    ) : (
                      <button
                        disabled
                        title="Assessment is not yet available for this course"
                        className="btn btn-secondary h-8 text-xs opacity-60 cursor-not-allowed"
                      >
                        <HelpCircle className="mr-1 h-3.5 w-3.5" /> Quiz Pending
                      </button>
                    )}
                  </div>
                  {!activeCourse.quiz_available && (
                    <p className="mt-2 text-[11px] text-ink-3 bg-sunken p-2 rounded">
                      This course does not currently have a published quiz. Complete the required learning resources to record your study progress.
                    </p>
                  )}
                </div>
              </div>

              {/* Lessons Syllabus Playlist */}
              <div className="card-raised flex flex-col p-5">
                <h3 className="text-sm font-semibold text-ink mb-3">Course Lessons Syllabus</h3>
                <div className="divide-y divide-rule-soft overflow-y-auto max-h-[450px]">
                  {lessons.map((lesson, idx) => {
                    const isSelected = idx === activeLessonIndex;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setActiveLessonIndex(idx)}
                        className={`w-full text-left py-3 px-3 rounded-lg transition-colors flex items-start gap-3 ${
                          isSelected
                            ? "bg-accent-soft text-ink font-medium"
                            : "hover:bg-hover text-ink-2"
                        }`}
                      >
                        <div className="mt-0.5">
                          {lesson.is_completed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : lesson.resource_opened ? (
                            <Eye className="h-4 w-4 text-blue-600" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-rule-strong flex items-center justify-center text-[10px] text-ink-3">
                              {idx + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs truncate ${
                              isSelected ? "font-semibold text-ink" : "text-ink-2"
                            }`}
                          >
                            {lesson.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-3">
                            <span>{lesson.provider}</span>
                            <span>•</span>
                            <span>{lesson.estimated_minutes} min</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Courses Grid: Assigned and Enrolled */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {courses.length === 0 ? (
              <div className="col-span-full py-16 text-center text-ink-3">
                <GraduationCap className="mx-auto mb-3 h-10 w-10 text-ink-3" />
                <p className="text-base font-semibold text-ink">No courses assigned yet</p>
                <p className="text-sm text-ink-2 mt-1">
                  Visit the Training catalog to browse and self-enroll in learning programs.
                </p>
              </div>
            ) : (
              courses.map((course) => (
                <div
                  key={course.enrollment_id}
                  className="card-raised flex flex-col justify-between p-5 border border-rule hover:border-accent transition-all duration-200"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-link">
                        {course.course_code}
                      </span>
                      <EnrollmentStatusBadge status={course.enrollment_status} />
                    </div>

                    <h3 className="mt-2 text-base font-bold text-ink leading-snug">{course.title}</h3>
                    <p className="mt-1 text-xs text-ink-3 line-clamp-2">{course.description}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {course.duration_hours}h
                      </span>
                      <span>•</span>
                      <span>{course.provider}</span>
                      <span>•</span>
                      <span className="capitalize">{course.difficulty_level.toLowerCase()}</span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-ink-3">
                        {course.total_lessons} {course.total_lessons === 1 ? "resource" : "resources"}
                      </span>
                      {course.quiz_passed ? (
                        <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          Quiz Passed ({Math.round(Number(course.quiz_score || 0))}%)
                        </span>
                      ) : course.quiz_available ? (
                        <span className="text-[11px] font-medium text-ink-2 bg-sunken px-2 py-0.5 rounded">
                          Quiz Available
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-ink-3 bg-sunken px-2 py-0.5 rounded">
                          Self-Paced
                        </span>
                      )}
                    </div>

                    {course.target_skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {course.target_skills.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-rule-soft pt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-ink-2">Progress</span>
                      <span className="font-semibold tabular-nums text-ink">
                        {Math.round(Number(course.progress_percentage || 0))}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sunken mb-4">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round(Number(course.progress_percentage || 0)))}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {course.enrollment_status === "COMPLETED" ? (
                        <button
                          onClick={() => loadCourseLessons(course)}
                          className="btn btn-secondary flex-1 h-9 text-xs font-semibold"
                        >
                          <BookOpen className="mr-1.5 h-3.5 w-3.5 text-link" />
                          View Course
                        </button>
                      ) : (
                        <button
                          onClick={() => loadCourseLessons(course)}
                          className="btn btn-primary flex-1 h-9 text-xs"
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          {course.progress_percentage > 0 ? "Resume Learning" : "Start Course"}
                        </button>
                      )}
                      {course.quiz_available ? (
                        <button
                          onClick={() => {
                            setActiveCourse(course);
                            openQuiz(course);
                          }}
                          title={course.enrollment_status === "COMPLETED" ? "Review certification quiz" : "Take certification quiz"}
                          className="btn h-9 px-3 text-xs"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          disabled
                          title="Certification quiz not yet published"
                          className="btn h-9 px-3 text-xs opacity-50 cursor-not-allowed"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )
      ) : (
        /* Before-and-After Skill Assessment Dashboard */
        <div className="space-y-6">
          <div className="card-raised p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink">Before-and-After Skill Assessment Tracking</h2>
              <p className="text-xs text-ink-2 mt-0.5">
                Measurable skill proficiency growth verified through formal pre-training (baseline) diagnostics and
                post-training reassessments against your target job role benchmarks.
              </p>
            </div>

            {assessments.length === 0 ? (
              <div className="py-12 text-center text-ink-3">
                <Target className="mx-auto mb-3 h-10 w-10 text-ink-3" />
                <p className="text-base font-semibold text-ink">No skill evaluations recorded yet</p>
                <p className="text-sm text-ink-2 mt-1">
                  Complete course modules and practical projects to schedule your baseline and post-training assessments.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-ink">
                  <thead className="bg-sunken text-[11px] uppercase tracking-wider text-ink-2 border-b border-rule">
                    <tr>
                      <th className="px-4 py-3">Skill</th>
                      <th className="px-4 py-3">Target Course</th>
                      <th className="px-4 py-3 text-center">Baseline Diagnostic</th>
                      <th className="px-4 py-3 text-center">Post-Training Evaluation</th>
                      <th className="px-4 py-3 text-center">Proficiency Delta</th>
                      <th className="px-4 py-3 text-center">Remaining Role Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-soft">
                    {assessments.map((a) => (
                      <tr key={a.skill_id} className="hover:bg-hover transition-colors">
                        <td className="px-4 py-3.5 font-bold text-ink">{a.skill_name}</td>
                        <td className="px-4 py-3.5 text-ink-2">{a.course_title || "General Skill Assessment"}</td>
                        <td className="px-4 py-3.5 text-center">
                          {a.baseline_score != null ? (
                            <span className="font-mono text-ink-2">
                              {a.baseline_score}% {a.current_proficiency != null ? `(Lvl ${a.current_proficiency})` : ""}
                            </span>
                          ) : (
                            <span className="text-ink-3 italic">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {a.post_score != null ? (
                            <span className="font-mono font-semibold text-ink">
                              {a.post_score}% {a.reassessed_proficiency != null ? `(Lvl ${a.reassessed_proficiency})` : ""}
                            </span>
                          ) : (
                            <span className="text-ink-3 italic">In Training</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {a.score_delta != null ? (
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                Number(a.score_delta) > 0
                                  ? "text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200"
                                  : "text-ink-2"
                              }`}
                            >
                              {Number(a.score_delta) > 0 ? `+${a.score_delta}%` : `${a.score_delta}%`}
                              {Number(a.score_delta) > 0 && <TrendingUp className="h-3 w-3" />}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {a.remaining_skill_gap != null ? (
                            a.remaining_skill_gap === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                                <CheckCircle className="h-3 w-3" /> Fully Qualified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Gap: {a.remaining_skill_gap} levels
                              </span>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {quizModalOpen && (
        <Modal
          title={quizData ? quizData.title : "Knowledge Assessment"}
          onClose={() => setQuizModalOpen(false)}
        >
          {quizLoading ? (
            <div className="space-y-4 py-8">
              <div className="skeleton h-6 w-3/4" />
              <div className="skeleton h-20" />
              <div className="skeleton h-20" />
            </div>
          ) : quizData ? (
            !quizData.quiz_available ? (
              <div className="py-8 text-center text-ink-3 space-y-3">
                <HelpCircle className="mx-auto h-12 w-12 text-ink-3 opacity-60" />
                <h4 className="text-sm font-bold text-ink">Assessment Not Yet Available</h4>
                <p className="text-xs text-ink-2 max-w-md mx-auto">
                  {quizData.message ||
                    "An active certification quiz is not currently published for this course."}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setQuizModalOpen(false)}
                    className="btn btn-secondary h-8 text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Attempt result banner if just submitted */}
                {latestAttempt && (
                  <div
                    className={`rounded-xl p-4 border ${
                      latestAttempt.passed
                        ? "bg-green-50 border-green-200 text-green-900"
                        : "bg-amber-50 border-amber-200 text-amber-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {latestAttempt.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <RotateCcw className="h-5 w-5 text-amber-600" />
                        )}
                        <div>
                          <h4 className="font-bold text-sm">
                            {latestAttempt.passed
                              ? "Assessment Passed!"
                              : "Passing Threshold Not Met"}
                          </h4>
                          <p className="text-xs mt-0.5">
                            Score: <span className="font-bold">{latestAttempt.score}%</span> (Minimum Required:{" "}
                            {quizData.passing_score}%)
                          </p>
                        </div>
                      </div>
                      {latestAttempt.course_completed && (
                        <span className="rounded-full bg-green-200 px-3 py-1 text-xs font-bold text-green-900">
                          Course Certified
                        </span>
                      )}
                    </div>

                    {/* Feedback Breakdown */}
                    {latestAttempt.breakdown && (
                      <div className="mt-4 border-t border-green-200/60 pt-3 space-y-3">
                        <p className="text-xs font-semibold">Question Feedback & Explanation:</p>
                        {latestAttempt.breakdown.map((b, i) => (
                          <div
                            key={b.question_id}
                            className="text-xs bg-white/70 p-2.5 rounded border border-rule-soft"
                          >
                            <p className="font-medium text-ink">
                              {i + 1}. {b.question_text}
                            </p>
                            <p
                              className={`mt-1 font-semibold ${
                                b.is_correct ? "text-green-700" : "text-red-700"
                              }`}
                            >
                              {b.is_correct ? "✓ Correct" : "✗ Incorrect"}
                            </p>
                            {b.explanation && (
                              <p className="mt-1 text-ink-2 italic">{b.explanation}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quiz Questions List (if allowed to attempt) */}
                {!latestAttempt?.passed && quizData.can_attempt && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmitQuiz();
                    }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between text-xs text-ink-2 bg-sunken p-3 rounded-lg">
                      <span>
                        Attempt {quizData.user_attempts_count + 1} of {quizData.max_attempts}
                        {attemptsHistory.length > 0 && ` (${attemptsHistory.length} recorded)`}
                      </span>
                      <span>Required: {quizData.passing_score}%</span>
                    </div>

                    {quizData.questions.map((q, qIdx) => (
                      <div key={q.id} className="rounded-xl border border-rule-soft p-4 bg-panel">
                        <p className="text-sm font-semibold text-ink mb-3">
                          {qIdx + 1}. {q.question_text}
                        </p>
                        <div className="space-y-2">
                          {q.options.map((opt) => (
                            <label
                              key={opt.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                                selectedAnswers[q.id] === opt.id
                                  ? "border-accent bg-accent-soft text-ink font-medium"
                                  : "border-rule bg-sunken hover:bg-hover text-ink-2"
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                value={opt.id}
                                checked={selectedAnswers[q.id] === opt.id}
                                onChange={() => handleAnswerSelect(q.id, opt.id)}
                                className="mt-0.5"
                                required
                              />
                              <span>{opt.option_text}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setQuizModalOpen(false)}
                        className="btn h-9 text-xs"
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        disabled={
                          submittingQuiz ||
                          Object.keys(selectedAnswers).length < quizData.questions.length
                        }
                        className="btn btn-primary h-9 text-xs"
                      >
                        {submittingQuiz ? "Scoring Quiz..." : "Submit Answers for Evaluation"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Retake button if failed and attempts remain */}
                {latestAttempt && !latestAttempt.passed && quizData.can_attempt && (
                  <button
                    onClick={() => {
                      setLatestAttempt(null);
                      setSelectedAnswers({});
                    }}
                    className="btn btn-primary w-full h-9 text-xs"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retake Quiz
                  </button>
                )}
              </div>
            )
          ) : null}
        </Modal>
      )}
    </div>
  );
};
