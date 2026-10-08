import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import type {
  EmployeeDetail,
  EmployeeSkillGapReport,
  PredictionHistoryItem,
  PredictionResult,
  Recommendation,
  RecommendationStatus,
  PerformanceReview,
  TrainingEnrollment,
} from "../types";
import {
  User,
  Brain,
  Cpu,
  GraduationCap,
  Award,
  Lightbulb,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { RiskBadge } from "../components/RiskBadge";
import { SkillGapList } from "../components/SkillGapList";
import { EnrollmentStatusBadge } from "../components/EnrollmentStatusBadge";

export const EmployeeDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [skillGapReport, setSkillGapReport] = useState<EmployeeSkillGapReport | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [latestPrediction, setLatestPrediction] = useState<PredictionHistoryItem | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [generatingRecs, setGeneratingRecs] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setPrediction(null);
    try {
      const [empRes, gapsRes, revRes, enrRes, recsRes, predRes] = await Promise.all([
        api.get(`/employees/${id}`),
        api.get(`/analytics/skill-gaps/employee/${id}`),
        api.get(`/performance`, { params: { employee_id: id } }),
        api.get(`/training/enrollments`, { params: { employee_id: id } }),
        api.get(`/recommendations`, { params: { employee_id: id } }),
        api.get(`/predictions/history`, { params: { employee_id: id, page_size: 1 } }),
      ]);

      setEmployee(empRes.data);
      setSkillGapReport(gapsRes.data);
      setReviews(revRes.data.items);
      setEnrollments(enrRes.data.items);
      setRecommendations(recsRes.data.items);
      setLatestPrediction(predRes.data.items[0] ?? null);
    } catch (err) {
      console.error("Failed to load employee details", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRunPrediction = async () => {
    if (!id) return;
    setPredicting(true);
    try {
      const res = await api.post(`/predictions/predict/${id}`);
      setPrediction(res.data);
    } catch (err) {
      alert(getErrorMessage(err, "ML prediction failed"));
    } finally {
      setPredicting(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    if (!id) return;
    setGeneratingRecs(true);
    try {
      const res = await api.post(`/recommendations/generate/${id}`);
      setRecommendations(res.data);
    } catch (err) {
      alert(getErrorMessage(err, "Failed to generate recommendations"));
    } finally {
      setGeneratingRecs(false);
    }
  };

  const handleUpdateRecStatus = async (recId: string, newStatus: RecommendationStatus) => {
    try {
      await api.patch(`/recommendations/${recId}/status`, { status: newStatus });
      setRecommendations((prev) => prev.map((r) => (r.id === recId ? { ...r, status: newStatus } : r)));
    } catch (err) {
      alert(getErrorMessage(err, "Failed to update status"));
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="card p-8 text-center text-sm text-ink-3">
        Employee not found.{" "}
        <Link to="/employees" className="font-semibold text-link">
          Back to directory
        </Link>
      </div>
    );
  }

  // Live run (with factor breakdown) takes precedence over the stored latest result
  const shownRisk = prediction ?? latestPrediction;
  const completedTrainings = enrollments.filter((e) => e.enrollment_status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Back link & Actions */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Link
          to="/employees"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Workforce Directory
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleRunPrediction} disabled={predicting} className="btn btn-primary">
            <Brain className="h-4 w-4" aria-hidden="true" />
            {predicting ? "Analyzing Risk Model..." : "Run Attrition Risk Assessment"}
          </button>
          <button onClick={handleGenerateRecommendations} disabled={generatingRecs} className="btn">
            <Lightbulb className="h-4 w-4 text-amber-600" aria-hidden="true" />
            {generatingRecs ? "Generating..." : "Generate Action Plans"}
          </button>
        </div>
      </div>

      {/* Profile header */}
      <div className="card flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-white">
            {employee.first_name[0]}
            {employee.last_name[0]}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold text-ink">
                {employee.full_name || `${employee.first_name} ${employee.last_name}`}
              </h1>
              <span className="rounded-md border border-accent-ring bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-link">
                {employee.employee_code}
              </span>
              <RiskBadge
                level={latestPrediction?.risk_level}
                score={latestPrediction ? Number(latestPrediction.prediction_score) : null}
              />
            </div>
            <p className="mt-0.5 text-sm text-ink-2">
              {employee.job_role?.title} • {employee.department?.name}
            </p>
            <p className="mt-1 text-xs text-ink-3">
              Joined {new Date(employee.date_of_joining).toLocaleDateString()} • {employee.work_location} (
              {employee.work_mode})
            </p>
          </div>
        </div>

        <dl className="grid w-full grid-cols-3 gap-6 border-t border-rule pt-4 md:w-auto md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Skill Alignment</dt>
            <dd className="text-xl font-semibold tabular-nums" style={{ color: "var(--risk-low)" }}>
              {skillGapReport ? `${skillGapReport.overall_skill_match_percentage.toFixed(0)}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Active Skill Gaps</dt>
            <dd
              className="text-xl font-semibold tabular-nums"
              style={{ color: skillGapReport?.skills_with_gap ? "var(--risk-critical)" : "var(--risk-low)" }}
            >
              {skillGapReport?.skills_with_gap ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Completed Trainings</dt>
            <dd className="text-xl font-semibold tabular-nums text-link">{completedTrainings}</dd>
          </div>
        </dl>
      </div>

      {/* Skills and attrition risk */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="card p-5 sm:p-6 lg:col-span-7" aria-labelledby="skills-title">
          <SectionHead
            id="skills-title"
            icon={Cpu}
            title="Skill Gap Diagnostics"
            note={`Target profile for: ${employee.job_role?.title ?? "-"}`}
            action={
              <span className="rounded-full border border-accent-ring bg-accent-soft px-3 py-1 text-xs font-semibold text-link">
                {skillGapReport?.critical_gaps_count ?? 0} Critical Gaps Identified
              </span>
            }
          />
          <SkillGapList gaps={skillGapReport?.gaps ?? []} />
        </section>

        <section className="card p-5 sm:p-6 lg:col-span-5" aria-labelledby="risk-title">
          <SectionHead
            id="risk-title"
            icon={Brain}
            title="Attrition Risk & ML"
            note={prediction ? `${prediction.algorithm} (${prediction.model_version})` : "Latest stored evaluation"}
            action={
              <button onClick={handleRunPrediction} disabled={predicting} className="btn h-8 px-3 text-xs">
                {predicting ? "Running..." : "Re-evaluate"}
              </button>
            }
          />

          {shownRisk ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="Predicted Risk Level"
                  value={shownRisk.risk_level.charAt(0) + shownRisk.risk_level.slice(1).toLowerCase()}
                  tone={`var(--risk-${shownRisk.risk_level.toLowerCase()})`}
                />
                <Stat label="Attrition Probability" value={`${Number(shownRisk.prediction_score).toFixed(1)}%`} />
                <Stat
                  label="Model Confidence"
                  value={
                    shownRisk.confidence_score != null
                      ? `${Math.round(Number(shownRisk.confidence_score) * 100)}%`
                      : "—"
                  }
                />
                <div className="rounded-lg border border-rule p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Evaluated</p>
                  <p className="mt-2 text-[13px] font-medium text-ink">
                    {new Date(shownRisk.generated_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {prediction ? (
                <div>
                  <h3 className="mb-3 text-[13px] font-semibold text-ink">Contributing factors</h3>
                  {prediction.contributing_factors.length === 0 && (
                    <p className="text-[13px] text-ink-3">No significant risk drivers or retention factors detected.</p>
                  )}
                  <ul className="space-y-2">
                    {prediction.contributing_factors.map((f, i) => (
                      <li
                        key={i}
                        className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                          f.impact === "NEGATIVE" ? "border-rose-100 bg-rose-50" : "border-emerald-100 bg-emerald-50"
                        }`}
                      >
                        <span className="flex items-start gap-2.5 text-[13px] text-ink">
                          {f.impact === "NEGATIVE" ? (
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" aria-hidden="true" />
                          ) : (
                            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                          )}
                          {f.description}
                        </span>
                        <span
                          className={`flex-shrink-0 text-[11px] font-semibold ${
                            f.impact === "NEGATIVE" ? "text-rose-700" : "text-emerald-700"
                          }`}
                        >
                          {f.impact === "NEGATIVE" ? "Risk driver" : "Retention factor"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg bg-sunken p-4 text-[13px] text-ink-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Primary drivers</p>
                  {shownRisk.prediction_reason || "Re-run the model to see the full factor breakdown."}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-rule-strong p-8 text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-link" aria-hidden="true" />
              <p className="text-sm font-semibold text-ink">This employee has not been assessed yet.</p>
              <p className="mb-4 mt-1 text-xs text-ink-3">Run the model to generate an attrition risk evaluation.</p>
              <button onClick={handleRunPrediction} disabled={predicting} className="btn btn-primary">
                Run Risk Evaluation
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Performance and employee details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="card p-5 sm:p-6 lg:col-span-7" aria-labelledby="perf-title">
          <SectionHead
            id="perf-title"
            icon={Award}
            title="Performance Reviews"
            note={`${reviews.length} review${reviews.length === 1 ? "" : "s"} on record`}
          />
          {reviews.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-3">No performance reviews recorded.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((rev) => (
                <li key={rev.id} className="rounded-xl border border-rule p-4">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{rev.review_period} Review</h3>
                      <p className="text-xs text-ink-3">
                        {new Date(rev.review_date).toLocaleDateString()} • Cycle: {rev.review_cycle}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold tabular-nums text-link">{rev.performance_score}/100</p>
                      <p className="text-xs text-ink-3">Rating {rev.overall_rating} / 5</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-sunken p-3">
                      <p className="mb-1 font-semibold text-emerald-700">Key Strengths</p>
                      <p className="text-ink-2">{rev.strengths || "Not recorded"}</p>
                    </div>
                    <div className="rounded-lg bg-sunken p-3">
                      <p className="mb-1 font-semibold text-amber-700">Areas for Development</p>
                      <p className="text-ink-2">{rev.improvement_areas || "Not recorded"}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6 lg:col-span-5" aria-labelledby="details-title">
          <SectionHead
            id="details-title"
            icon={User}
            title="Employee Details"
            note="Contact, role and reporting line"
          />
          <h3 className="mb-1 text-[13px] font-semibold text-ink">Contact &amp; Identity</h3>
          <dl>
            <DetailRow label="Official Email" value={employee.official_email} />
            <DetailRow label="Phone Number" value={employee.phone_number} />
            <DetailRow label="Work Location" value={employee.work_location} />
            <DetailRow label="Employment Type" value={employee.employment_type.replace("_", " ")} />
          </dl>
          <h3 className="mb-1 mt-5 text-[13px] font-semibold text-ink">Organization &amp; Hierarchy</h3>
          <dl>
            <DetailRow label="Department" value={employee.department?.name} />
            <DetailRow
              label="Job Role"
              value={
                employee.job_role ? `${employee.job_role.title} (Grade ${employee.job_role.grade_level})` : undefined
              }
            />
            <DetailRow
              label="Reporting Manager"
              value={employee.manager ? `${employee.manager.first_name} ${employee.manager.last_name}` : "None"}
            />
            <DetailRow
              label="Overtime Frequency"
              value={employee.overtime_frequency ? employee.overtime_frequency.toLowerCase() : "none"}
              capitalize
            />
          </dl>
        </section>
      </div>

      {/* Training and action plans */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6" aria-labelledby="training-title">
          <SectionHead
            id="training-title"
            icon={GraduationCap}
            title="Training & Courses"
            note={`${completedTrainings} of ${enrollments.length} completed`}
          />
          {enrollments.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-3">No training courses enrolled.</p>
          ) : (
            <ul className="space-y-3">
              {enrollments.map((en) => (
                <li
                  key={en.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-rule p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink">{en.course?.title || "Course"}</h3>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {en.course?.course_code} • {en.course?.provider} • {Number(en.course?.duration_hours ?? 0)} hrs
                    </p>
                    <p className="mt-1 text-xs text-ink-3">
                      Enrolled on {new Date(en.enrollment_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0 sm:text-right">
                    <EnrollmentStatusBadge status={en.enrollment_status} />
                    {en.completion_score != null && (
                      <p className="mt-1 text-xs font-semibold text-emerald-600">
                        Score: {Number(en.completion_score)}%
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="plans-title">
          <SectionHead
            id="plans-title"
            icon={Lightbulb}
            title="Retention & Action Plans"
            note={`${recommendations.length} action${recommendations.length === 1 ? "" : "s"} for this employee`}
          />
          {recommendations.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-3">No recommendation action plans created.</p>
          ) : (
            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li key={rec.id} className="rounded-xl border border-rule p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-accent-ring bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-link">
                        {rec.recommendation_type.replace("_", " ")}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                          rec.priority === "CRITICAL" || rec.priority === "HIGH"
                            ? "border-rose-100 bg-rose-50 text-rose-700"
                            : "border-amber-100 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {rec.priority} Priority
                      </span>
                    </div>
                    <select
                      value={rec.status}
                      aria-label="Recommendation status"
                      onChange={(e) => handleUpdateRecStatus(rec.id, e.target.value as RecommendationStatus)}
                      className="h-8 rounded-lg border border-rule-strong bg-panel px-2.5 text-xs text-ink-2"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="ACCEPTED">Accepted</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                  <h3 className="text-sm font-semibold text-ink">{rec.title}</h3>
                  <p className="mt-1 text-[13px] text-ink-2">{rec.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value?: string; capitalize?: boolean }> = ({ label, value, capitalize }) => (
  <div className="flex justify-between gap-4 border-b border-rule py-2.5 text-[13px] last:border-b-0">
    <dt className="flex-shrink-0 text-ink-3">{label}</dt>
    <dd className={`break-all text-right font-medium text-ink ${capitalize ? "capitalize" : ""}`}>{value || "—"}</dd>
  </div>
);

const SectionHead: React.FC<{
  icon: React.ElementType;
  title: string;
  note?: string;
  id: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, note, id, action }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft text-link">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div>
        <h2 id={id} className="text-[15px] font-semibold text-ink">
          {title}
        </h2>
        {note && <p className="text-xs text-ink-3">{note}</p>}
      </div>
    </div>
    {action}
  </div>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone }) => (
  <div className="rounded-lg border border-rule p-3.5">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
    <p className="mt-1 text-[22px] font-semibold leading-tight tabular-nums" style={{ color: tone ?? "var(--ink)" }}>
      {value}
    </p>
  </div>
);
