import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type {
  EmployeeDetail,
  EmployeeSkillGapReport,
  PerformanceTrendSummary,
  TrainingCourse,
  TrainingEnrollment,
} from "../types";
import { Award, Clock, Cpu, GraduationCap, Sparkles, TrendingDown, TrendingUp, Minus, UserX } from "lucide-react";
import { SkillGapList } from "../components/SkillGapList";
import { EnrollmentStatusBadge } from "../components/EnrollmentStatusBadge";

const TREND = {
  IMPROVING: { label: "Improving", icon: TrendingUp, className: "text-emerald-600" },
  STABLE: { label: "Stable", icon: Minus, className: "text-slate-500" },
  DECLINING: { label: "Declining", icon: TrendingDown, className: "text-rose-600" },
} as const;

/**
 * Self-service home for EMPLOYEE accounts: the user's own skills, learning, and reviews.
 * Organization-wide HR data (attrition risk, rosters) is deliberately not shown here.
 */
export const MyDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const employeeId = user?.employee_id ?? null;

  const [profile, setProfile] = useState<EmployeeDetail | null>(null);
  const [gaps, setGaps] = useState<EmployeeSkillGapReport | null>(null);
  const [performance, setPerformance] = useState<PerformanceTrendSummary | null>(null);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, gapsRes, perfRes, enrRes, coursesRes] = await Promise.all([
        api.get("/employees/me"),
        api.get(`/analytics/skill-gaps/employee/${employeeId}`),
        api.get(`/performance/employee/${employeeId}/summary`),
        api.get("/training/enrollments", { params: { page_size: 100 } }),
        api.get("/training/courses", { params: { active_only: true } }),
      ]);
      setProfile(profileRes.data);
      setGaps(gapsRes.data);
      setPerformance(perfRes.data);
      setEnrollments(enrRes.data.items);
      setCourses(coursesRes.data);
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
  // Courses that train a skill the employee is currently below target on
  const suggestedCourses = courses.filter(
    (c) => !enrolledCourseIds.has(c.id) && c.training_skills?.some((ts) => gapSkillIds.has(ts.skill_id))
  );
  const completed = enrollments.filter((e) => e.enrollment_status === "COMPLETED").length;
  const inProgress = enrollments.filter((e) => e.enrollment_status === "IN_PROGRESS" || e.enrollment_status === "ENROLLED").length;
  const trend = performance ? TREND[performance.trend] ?? TREND.STABLE : null;
  const TrendIcon = trend?.icon;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
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
            {profile.employee_code} • Joined {new Date(profile.date_of_joining).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard icon={Cpu} tint="bg-emerald-50 text-emerald-600" label="Skill Alignment" value={`${gaps.overall_skill_match_percentage.toFixed(0)}%`} />
        <StatCard
          icon={Sparkles}
          tint="bg-rose-50 text-rose-600"
          label="Skills Below Target"
          value={`${gaps.skills_with_gap} of ${gaps.total_required_skills}`}
        />
        <StatCard
          icon={Award}
          tint="bg-indigo-50 text-indigo-600"
          label="Latest Performance"
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
          label="Learning"
          value={`${completed} done`}
          footer={<span className="text-xs text-slate-500">{inProgress} in progress</span>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Skill profile */}
        <div className="xl:col-span-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">My Skill Profile</h3>
          <p className="text-xs text-slate-600 mb-5">
            Your proficiency against the requirements for <span className="font-semibold text-indigo-700">{gaps.job_role_title}</span>.
          </p>
          <SkillGapList gaps={gaps.gaps} />
        </div>

        {/* Suggested courses */}
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Recommended for You</h3>
          <p className="text-xs text-slate-600 mb-5">Courses that close your current skill gaps.</p>
          {suggestedCourses.length === 0 ? (
            <p className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
              {gapSkillIds.size === 0
                ? "You meet every skill requirement for your role. Nice work!"
                : "You're already enrolled in every course that targets your gaps."}
            </p>
          ) : (
            <div className="space-y-3">
              {suggestedCourses.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">{c.title}</h4>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> {Number(c.duration_hours)} hrs • {c.provider} •{" "}
                    {c.difficulty_level.toLowerCase()}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.training_skills
                      ?.filter((ts) => gapSkillIds.has(ts.skill_id))
                      .map((ts) => (
                        <span key={ts.id} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                          Builds {ts.skill?.name}
                        </span>
                      ))}
                  </div>
                  <button
                    onClick={() => handleEnroll(c.id)}
                    disabled={enrollingId === c.id}
                    className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {enrollingId === c.id ? "Enrolling..." : "Enroll"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My learning */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">My Learning</h3>
            <Link to="/training" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              Browse catalog
            </Link>
          </div>
          {activeEnrollments.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">You're not enrolled in any courses yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeEnrollments.map((en) => (
                <li key={en.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{en.course?.title}</p>
                    <p className="text-xs text-slate-500">
                      Enrolled {new Date(en.enrollment_date).toLocaleDateString()}
                      {en.completion_score != null && ` • Score ${Number(en.completion_score)}%`}
                    </p>
                  </div>
                  <EnrollmentStatusBadge status={en.enrollment_status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Reviews */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4">My Performance Reviews</h3>
          {!performance || performance.recent_reviews.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No reviews recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {performance.recent_reviews.map((rev) => (
                <li key={rev.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{rev.review_period}</p>
                    <span className="text-sm font-bold text-indigo-600">
                      {Number(rev.performance_score).toFixed(0)}/100 · {rev.overall_rating}/5
                    </span>
                  </div>
                  {rev.strengths && <p className="mt-1 text-xs text-slate-600">Strengths: {rev.strengths}</p>}
                  {rev.improvement_areas && (
                    <p className="mt-0.5 text-xs text-slate-500">Focus areas: {rev.improvement_areas}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
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
