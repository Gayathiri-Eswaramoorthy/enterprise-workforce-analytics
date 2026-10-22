import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type {
  EmployeeDetail,
  EmployeeRequest,
  EmployeeSkillGapReport,
  MyCourseProgress,
  PerformanceTrendSummary,
  TrainingCourse,
  TrainingEnrollment,
} from "../types";
import {
  Award,
  Clock,
  Cpu,
  GraduationCap,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
  UserX,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  Send,
  X,
  ArrowRight,
  Layers,
} from "lucide-react";
import { SkillGapList } from "../components/SkillGapList";
import { EnrollmentStatusBadge } from "../components/EnrollmentStatusBadge";

const TREND = {
  IMPROVING: { label: "Improving", icon: TrendingUp, className: "text-emerald-600" },
  STABLE: { label: "Stable", icon: Minus, className: "text-slate-500" },
  DECLINING: { label: "Declining", icon: TrendingDown, className: "text-rose-600" },
} as const;

export const MyDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const employeeId = user?.employee_id ?? null;

  const [profile, setProfile] = useState<EmployeeDetail | null>(null);
  const [gaps, setGaps] = useState<EmployeeSkillGapReport | null>(null);
  const [performance, setPerformance] = useState<PerformanceTrendSummary | null>(null);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [myProgressCourses, setMyProgressCourses] = useState<MyCourseProgress[]>([]);
  const [discussionRequests, setDiscussionRequests] = useState<EmployeeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  // Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    request_type: "CAREER_DISCUSSION",
    topic: "",
    notes: "",
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, gapsRes, perfRes, enrRes, coursesRes, progressRes, requestsRes] = await Promise.all([
        api.get("/employees/me"),
        api.get(`/analytics/skill-gaps/employee/${employeeId}`),
        api.get(`/performance/employee/${employeeId}/summary`),
        api.get("/training/enrollments", { params: { page_size: 100 } }),
        api.get("/training/courses", { params: { active_only: true } }),
        api.get("/learning/my-courses"),
        api.get("/employees/me/discussion-requests"),
      ]);
      setProfile(profileRes.data);
      setGaps(gapsRes.data);
      setPerformance(perfRes.data);
      setEnrollments(enrRes.data.items);
      setCourses(coursesRes.data);
      setMyProgressCourses(progressRes.data || []);
      setDiscussionRequests(requestsRes.data || []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your dashboard."));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEnroll = async (courseId: string) => {
    if (!employeeId) return;
    setEnrollingId(courseId);
    try {
      await api.post("/training/enrollments", { employee_id: employeeId, training_course_id: courseId });
      await fetchData();
    } catch (err) {
      alert(getErrorMessage(err, "Enrollment failed"));
    } finally {
      setEnrollingId(null);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRequest(true);
    setRequestError(null);
    try {
      await api.post("/employees/me/discussion-request", requestForm);
      setRequestSuccess("Your discussion request has been sent to HR. A specialist will review it shortly.");
      setRequestForm({
        request_type: "CAREER_DISCUSSION",
        topic: "",
        notes: "",
      });
      setShowRequestModal(false);
      await fetchData();
    } catch (err) {
      setRequestError(getErrorMessage(err, "Failed to submit request"));
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <UserX className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <h2 className="text-lg font-bold text-slate-900">No employee profile linked</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your login isn't connected to an employee record yet. Ask HR to link your account to see your skills,
          training, and reviews here.
        </p>
      </div>
    );
  }

  if (error || !profile || !gaps) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error ?? "Could not load your dashboard."}
      </div>
    );
  }

  const activeEnrollments = enrollments.filter((e) => e.enrollment_status !== "DROPPED");
  const enrolledCourseIds = new Set(activeEnrollments.map((e) => e.training_course_id));
  const gapSkillIds = new Set(gaps.gaps.filter((g) => g.gap > 0).map((g) => g.skill_id));

  // Courses that develop targeted skills (optional growth pathways)
  const suggestedCourses = courses.filter(
    (c) => !enrolledCourseIds.has(c.id) && c.training_skills?.some((ts) => gapSkillIds.has(ts.skill_id))
  );

  const completed = enrollments.filter((e) => e.enrollment_status === "COMPLETED").length;
  const inProgress = enrollments.filter(
    (e) => e.enrollment_status === "IN_PROGRESS" || e.enrollment_status === "ENROLLED"
  ).length;
  const trend = performance ? TREND[performance.trend] ?? TREND.STABLE : null;
  const TrendIcon = trend?.icon;

  return (
    <div className="space-y-6">
      {/* Welcome header with Request HR Discussion action */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-sm">
            {profile.first_name[0]}
            {profile.last_name[0]}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Welcome back, {profile.first_name}</h1>
            <p className="text-sm text-slate-600">
              {profile.job_role?.title} • {profile.department?.name}
              {profile.manager && ` • Reports to ${profile.manager.first_name} ${profile.manager.last_name}`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Employee ID: <span className="font-mono text-slate-700">{profile.employee_code}</span> • Joined{" "}
              {new Date(profile.date_of_joining).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowRequestModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <MessageSquare className="h-4 w-4" /> Express Learning Interest / Request HR Discussion
          </button>
          <Link
            to="/my-learning"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <BookOpen className="h-4 w-4" /> My Learning Workspace
          </Link>
        </div>
      </div>

      {requestSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            {requestSuccess}
          </span>
          <button onClick={() => setRequestSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          icon={Cpu}
          tint="bg-emerald-50 text-emerald-600"
          label="Role Competency Match"
          value={`${gaps.overall_skill_match_percentage.toFixed(0)}%`}
          footer={<span className="text-xs text-slate-500">Target role alignment</span>}
        />
        <StatCard
          icon={Sparkles}
          tint="bg-indigo-50 text-indigo-600"
          label="Optional Growth Areas"
          value={`${gaps.skills_with_gap} skills`}
          footer={
            <span className="text-xs text-slate-500">
              {gaps.critical_gaps_count > 0 ? `${gaps.critical_gaps_count} priority skills` : "All requirements on track"}
            </span>
          }
        />
        <StatCard
          icon={Award}
          tint="bg-purple-50 text-purple-600"
          label="Performance Review"
          value={performance?.latest_score != null ? `${Number(performance.latest_score).toFixed(0)}/100` : "—"}
          footer={
            trend && TrendIcon ? (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold ${trend.className}`}>
                <TrendIcon className="h-3.5 w-3.5" /> {trend.label}
              </span>
            ) : null
          }
        />
        <StatCard
          icon={GraduationCap}
          tint="bg-sky-50 text-sky-600"
          label="Courses & Learning"
          value={`${completed} done`}
          footer={<span className="text-xs text-slate-500">{inProgress} active courses</span>}
        />
      </div>

      {/* Skill Profile & Optional Growth Pathways */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Skill profile */}
        <div className="xl:col-span-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" /> My Skill Proficiency & Competency Profile
            </h3>
          </div>
          <p className="text-xs text-slate-600 mb-5">
            Evaluated proficiency against role expectations for{" "}
            <span className="font-semibold text-indigo-700">{gaps.job_role_title}</span>. Skill gaps indicate optional
            development opportunities.
          </p>
          <SkillGapList gaps={gaps.gaps} />
        </div>

        {/* Optional Learning & Growth Pathways */}
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" /> Optional Learning Pathways
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Voluntary
            </span>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Recommended courses aligned with your role development. Enroll voluntarily at your own pace.
          </p>

          {suggestedCourses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 p-6 text-center text-sm text-emerald-700">
              <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-600" />
              <p className="font-semibold">You are all set!</p>
              <p className="text-xs text-emerald-600 mt-1">
                {gapSkillIds.size === 0
                  ? "You meet role proficiency requirements across every skill."
                  : "You are already enrolled in available courses targeting your skills."}
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
              {suggestedCourses.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-4 hover:border-indigo-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">{c.title}</h4>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                      {c.difficulty_level.toLowerCase()}
                    </span>
                  </div>

                  {c.description && (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{c.description}</p>
                  )}

                  <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> {Number(c.duration_hours)} hrs
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-slate-400" /> {c.lessons_count || 3} lessons
                    </span>
                    <span>•</span>
                    <span>{c.training_mode}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.training_skills
                      ?.filter((ts) => gapSkillIds.has(ts.skill_id))
                      .map((ts) => (
                        <span
                          key={ts.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                        >
                          Develops {ts.skill?.name}
                        </span>
                      ))}
                  </div>

                  <button
                    onClick={() => handleEnroll(c.id)}
                    disabled={enrollingId === c.id}
                    className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {enrollingId === c.id ? "Enrolling..." : "Enroll Voluntarily"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Learning Progress & Discussion Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrolled Courses & Detailed Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" /> My Learning Progress
              </h3>
              <p className="text-xs text-slate-500">Lessons completed, course completion %, and assessment status</p>
            </div>
            <Link to="/my-learning" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              Go to learning room <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {myProgressCourses.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              You are not currently enrolled in any courses. Browse optional courses above to start learning!
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {myProgressCourses.map((mc) => {
                const pct = Math.round(Number(mc.progress_percentage || 0));
                return (
                  <li key={mc.course_id} className="py-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/my-learning"
                          className="text-sm font-semibold text-slate-900 hover:text-indigo-600 truncate block"
                        >
                          {mc.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {mc.completed_lessons} of {mc.total_lessons} lessons completed • {Number(mc.duration_hours)} hrs
                        </p>
                      </div>
                      <EnrollmentStatusBadge status={mc.enrollment_status} />
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>Course Completion</span>
                        <span className="font-semibold text-indigo-700">{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>
                        Quiz status:{" "}
                        <strong className={mc.quiz_passed ? "text-emerald-600" : "text-slate-700"}>
                          {mc.quiz_passed
                            ? `Passed (${Number(mc.quiz_score)}%)`
                            : mc.quiz_available
                            ? "Available to take"
                            : "Complete lessons first"}
                        </strong>
                      </span>
                      <Link
                        to="/my-learning"
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        Continue Lesson →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* HR Discussion & Learning Requests */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-indigo-600" /> My Career & Learning Requests
              </h3>
              <p className="text-xs text-slate-500">Requests submitted to HR for 1-on-1 check-ins or topic inquiries</p>
            </div>
            <button
              onClick={() => setShowRequestModal(true)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              + New Request
            </button>
          </div>

          {discussionRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              No discussion requests submitted yet. Click "New Request" above to discuss career development or training interests with HR.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {discussionRequests.map((req) => (
                <li key={req.id} className="py-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">{req.topic}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        req.status === "RESOLVED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : req.status === "REVIEWED"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Type: <span className="text-slate-700">{req.request_type.replace(/_/g, " ")}</span> • Submitted{" "}
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                  {req.notes && <p className="text-xs text-slate-600 italic">"{req.notes}"</p>}
                  {req.response_notes && (
                    <div className="mt-1 rounded-md bg-indigo-50/70 border border-indigo-100 p-2 text-xs text-indigo-900">
                      <strong>HR Feedback:</strong> {req.response_notes}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Express Learning Interest / Request HR Discussion Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-600" /> Express Learning Interest or Request Discussion
              </h2>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitRequest} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Request Category *</label>
                <select
                  value={requestForm.request_type}
                  onChange={(e) => setRequestForm({ ...requestForm, request_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                >
                  <option value="CAREER_DISCUSSION">Career Development Discussion (1-on-1 with HR / Manager)</option>
                  <option value="LEARNING_INTEREST">Express Learning Interest in a Skill / Technology</option>
                  <option value="WORKLOAD_FEEDBACK">Workload & Work-Life Balance Check-in</option>
                  <option value="OTHER">Other Support or Mentorship Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Subject or Skill *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Architecture Pathway, Career roadmap check-in for Q3"
                  value={requestForm.topic}
                  onChange={(e) => setRequestForm({ ...requestForm, topic: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Context & Questions (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Share details about what you would like to discuss or learn..."
                  value={requestForm.notes}
                  onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              {requestError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                  {requestError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submittingRequest ? "Submitting..." : "Submit to HR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ElementType;
  tint: string;
  label: string;
  value: string;
  footer?: React.ReactNode;
}> = ({ icon: Icon, tint, label, value, footer }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-5">
    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${tint}`}>
      <Icon className="h-6 w-6" />
    </div>
    <div className="min-w-0">
      <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      {footer && <div>{footer}</div>}
    </div>
  </div>
);
