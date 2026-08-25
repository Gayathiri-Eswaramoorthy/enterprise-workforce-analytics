import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import type {
  EmployeeDetail,
  EmployeeSkillGapReport,
  PredictionResult,
  Recommendation,
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

export const EmployeeDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [skillGapReport, setSkillGapReport] = useState<EmployeeSkillGapReport | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "skills" | "prediction" | "performance" | "training" | "recommendations">("skills");
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [generatingRecs, setGeneratingRecs] = useState(false);

  const fetchAllData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [empRes, gapsRes, revRes, enrRes, recsRes] = await Promise.all([
        api.get(`/employees/${id}`),
        api.get(`/analytics/skill-gaps/employee/${id}`),
        api.get(`/performance/employee/${id}`),
        api.get(`/training/enrollments`, { params: { employee_id: id } }),
        api.get(`/recommendations`, { params: { employee_id: id } }),
      ]);

      setEmployee(empRes.data);
      setSkillGapReport(gapsRes.data);
      setReviews(revRes.data);
      setEnrollments(enrRes.data.items);
      setRecommendations(recsRes.data.items);
    } catch (err) {
      console.error("Failed to load employee details", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [id]);

  const handleRunPrediction = async () => {
    if (!id) return;
    setPredicting(true);
    try {
      const res = await api.post(`/predictions/predict/${id}`);
      setPrediction(res.data);
      setActiveTab("prediction");
    } catch (err: any) {
      alert(err.response?.data?.detail || "ML prediction failed");
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
      setActiveTab("recommendations");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to generate recommendations");
    } finally {
      setGeneratingRecs(false);
    }
  };

  const handleUpdateRecStatus = async (recId: string, newStatus: string) => {
    try {
      await api.patch(`/recommendations/${recId}/status`, { status: newStatus });
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, status: newStatus as any } : r))
      );
    } catch (err: any) {
      alert("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!employee) return <div>Employee not found.</div>;

  return (
    <div className="space-y-6">
      {/* Back link & Actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/employees"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Workforce Directory
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunPrediction}
            disabled={predicting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50"
          >
            <Brain className="h-4 w-4" /> {predicting ? "Analyzing ML Model..." : "Run ML Risk Assessment"}
          </button>
          <button
            onClick={handleGenerateRecommendations}
            disabled={generatingRecs}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <Lightbulb className="h-4 w-4 text-amber-400" /> Generate Action Plans
          </button>
        </div>
      </div>

      {/* Header Profile Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#0F1524] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-400 font-bold text-2xl text-white shadow-md shadow-indigo-600/20">
            {employee.first_name[0]}
            {employee.last_name[0]}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-100">{employee.full_name || `${employee.first_name} ${employee.last_name}`}</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {employee.employee_code}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {employee.job_role?.title} • {employee.department?.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Joined {new Date(employee.date_of_joining).toLocaleDateString()} • {employee.work_location} ({employee.work_mode})
            </p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
              Skill Alignment
            </span>
            <span className="text-xl font-bold text-emerald-400">
              {skillGapReport?.overall_skill_match_percentage.toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
              Active Skill Gaps
            </span>
            <span className="text-xl font-bold text-rose-400">
              {skillGapReport?.total_gaps_identified}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
              Completed Trainings
            </span>
            <span className="text-xl font-bold text-sky-400">
              {enrollments.filter((e) => e.enrollment_status === "COMPLETED").length}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        {[
          { id: "skills", label: "Skill Gap Diagnostics", icon: Cpu },
          { id: "prediction", label: "Predictive Risk & ML", icon: Brain },
          { id: "performance", label: "Performance Reviews", icon: Award },
          { id: "training", label: "Training & Courses", icon: GraduationCap },
          { id: "recommendations", label: "Retention & Action Plans", icon: Lightbulb },
          { id: "overview", label: "Employee Details", icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                isActive
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: Skill Gap Diagnostics */}
      {activeTab === "skills" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#0F1524] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-100">Job Role Skill Requirements vs. Current Proficiency</h3>
                <p className="text-xs text-slate-400">
                  Target profile for: <span className="text-indigo-400 font-semibold">{employee.job_role?.title}</span>
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {skillGapReport?.critical_gaps_count} Critical Gaps Identified
              </span>
            </div>

            <div className="space-y-4">
              {skillGapReport?.gaps.map((item) => (
                <div key={item.skill_id} className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-200">{item.skill_name}</span>
                      {item.mandatory && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Mandatory
                        </span>
                      )}
                      <span className="text-xs text-slate-500">({item.skill_category})</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        Current: <strong className="text-slate-200">{item.current_proficiency}/5</strong> • Target: <strong className="text-slate-200">{item.required_proficiency}/5</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.severity === "CRITICAL"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : item.severity === "HIGH"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : item.severity === "MEDIUM"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {item.severity === "NONE" ? "Proficient" : `${item.severity} GAP (-${item.gap})`}
                      </span>
                    </div>
                  </div>

                  {/* Progress visual comparison */}
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${item.gap > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${(item.current_proficiency / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ML Predictive Risk */}
      {activeTab === "prediction" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#0F1524] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-400" /> Machine Learning Workforce Attrition Prediction
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Gradient Boosting Classifier with multi-variate feature analysis and transparent explanations.
                </p>
              </div>
              <button
                onClick={handleRunPrediction}
                disabled={predicting}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition-colors"
              >
                {predicting ? "Running..." : "Re-evaluate Risk Model"}
              </button>
            </div>

            {prediction ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Predicted Risk Level</span>
                    <span className="text-2xl font-black text-rose-400 mt-1 block">{prediction.risk_level}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Attrition Probability Score</span>
                    <span className="text-2xl font-black text-indigo-400 mt-1 block">{Number(prediction.prediction_score).toFixed(1)}%</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Inference Date</span>
                    <span className="text-sm font-semibold text-slate-200 mt-2 block">{new Date(prediction.generated_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Explanation factors */}
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-3">Model Contributing Factors & Explainability</h4>
                  <div className="space-y-2">
                    {prediction.contributing_factors.map((f, i) => (
                      <div
                        key={i}
                        className={`p-3.5 rounded-xl border flex items-center justify-between ${
                          f.impact === "NEGATIVE"
                            ? "bg-rose-500/5 border-rose-500/20"
                            : "bg-emerald-500/5 border-emerald-500/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {f.impact === "NEGATIVE" ? (
                            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                          )}
                          <span className="text-sm text-slate-200">{f.description}</span>
                        </div>
                        <span
                          className={`text-xs font-bold ${
                            f.impact === "NEGATIVE" ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {f.impact === "NEGATIVE" ? "Risk Driver" : "Retention Factor"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-[#0B0F19] rounded-xl border border-slate-800">
                <Sparkles className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300 font-medium">No live prediction generated yet.</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">Click below to trigger real-time AI risk evaluation.</p>
                <button
                  onClick={handleRunPrediction}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  Run Risk Evaluation
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Performance Reviews */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div key={rev.id} className="p-6 rounded-2xl border border-slate-800 bg-[#0F1524]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-100">{rev.review_period} Review</h4>
                  <p className="text-xs text-slate-500">Date: {new Date(rev.review_date).toLocaleDateString()} • Cycle: {rev.review_cycle}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-indigo-400">{rev.performance_score}/100</span>
                  <p className="text-xs text-slate-400">Rating: {rev.overall_rating} / 5 Stars</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800">
                  <strong className="text-emerald-400 block mb-1">Key Strengths</strong>
                  <p className="text-slate-300">{rev.strengths || "Consistently meets engineering delivery targets."}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-slate-800">
                  <strong className="text-amber-400 block mb-1">Areas for Development</strong>
                  <p className="text-slate-300">{rev.improvement_areas || "Upskilling in modern architectural stacks."}</p>
                </div>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No performance reviews recorded.</p>}
        </div>
      )}

      {/* TAB CONTENT: Training */}
      {activeTab === "training" && (
        <div className="space-y-4">
          {enrollments.map((en) => (
            <div key={en.id} className="p-5 rounded-2xl border border-slate-800 bg-[#0F1524] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200">{en.training_course?.title || "Course"}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code: {en.training_course?.course_code} • Provider: {en.training_course?.provider} • Duration: {en.training_course?.duration_hours} hrs
                </p>
                <p className="text-xs text-slate-400 mt-1">Enrolled on {new Date(en.enrollment_date).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {en.enrollment_status}
                </span>
                {en.completion_score && (
                  <p className="text-xs font-bold text-emerald-400 mt-1">Score: {en.completion_score}%</p>
                )}
              </div>
            </div>
          ))}
          {enrollments.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No training courses enrolled.</p>}
        </div>
      )}

      {/* TAB CONTENT: Recommendations */}
      {activeTab === "recommendations" && (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="p-6 rounded-2xl border border-slate-800 bg-[#0F1524]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                    {rec.recommendation_type}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      rec.priority === "CRITICAL" || rec.priority === "HIGH"
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {rec.priority} Priority
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={rec.status}
                    onChange={(e) => handleUpdateRecStatus(rec.id, e.target.value)}
                    className="rounded-lg border border-slate-800 bg-[#0B0F19] px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="ACCEPTED">ACCEPTED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-100">{rec.title}</h4>
              <p className="text-sm text-slate-400 mt-1">{rec.description}</p>
              {rec.action_plan && (
                <div className="mt-3 p-3 rounded-xl bg-[#0B0F19] border border-slate-800 text-xs text-slate-300">
                  <strong className="text-indigo-400 block mb-1">Recommended Action Plan</strong>
                  {rec.action_plan}
                </div>
              )}
            </div>
          ))}
          {recommendations.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No recommendation action plans created.</p>
          )}
        </div>
      )}

      {/* TAB CONTENT: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#0F1524] space-y-4 text-sm">
            <h4 className="font-bold text-slate-200 text-base">Contact & Identity</h4>
            <div className="flex justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400">Official Email</span>
              <span className="text-slate-200">{employee.official_email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400">Phone Number</span>
              <span className="text-slate-200">{employee.phone_number}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400">Work Location</span>
              <span className="text-slate-200">{employee.work_location}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400">Employment Type</span>
              <span className="text-slate-200">{employee.employment_type}</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-800 bg-[#0F1524] space-y-4 text-sm">
            <h4 className="font-bold text-slate-200 text-base">Organization & Hierarchy</h4>
            <div className="flex justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400">Department</span>
              <span className="text-slate-200">{employee.department?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400">Job Role</span>
              <span className="text-slate-200">{employee.job_role?.title} (Grade {employee.job_role?.grade_level})</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/60">
              <span className="text-slate-400">Reporting Manager</span>
              <span className="text-slate-200">{employee.manager ? `${employee.manager.first_name} ${employee.manager.last_name}` : "None"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
