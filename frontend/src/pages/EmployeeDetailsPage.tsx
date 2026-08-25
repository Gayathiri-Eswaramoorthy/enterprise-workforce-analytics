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
        api.get(`/performance`, { params: { employee_id: id } }),
        api.get(`/training/enrollments`, { params: { employee_id: id } }),
        api.get(`/recommendations`, { params: { employee_id: id } }),
      ]);

      setEmployee(empRes.data);
      setSkillGapReport(gapsRes.data);
      setReviews(revRes.data.items);
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
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Workforce Directory
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunPrediction}
            disabled={predicting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            <Brain className="h-4 w-4" /> {predicting ? "Analyzing Risk Model..." : "Run Attrition Risk Assessment"}
          </button>
          <button
            onClick={handleGenerateRecommendations}
            disabled={generatingRecs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Lightbulb className="h-4 w-4 text-amber-600" /> Generate Action Plans
          </button>
        </div>
      </div>

      {/* Header Profile Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-600 font-bold text-2xl text-white shadow-sm">
            {employee.first_name[0]}
            {employee.last_name[0]}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{employee.full_name || `${employee.first_name} ${employee.last_name}`}</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {employee.employee_code}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-0.5">
              {employee.job_role?.title} • {employee.department?.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Joined {new Date(employee.date_of_joining).toLocaleDateString()} • {employee.work_location} ({employee.work_mode})
            </p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-8">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
              Skill Alignment
            </span>
            <span className="text-xl font-bold text-emerald-600">
              {skillGapReport?.overall_skill_match_percentage.toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
              Active Skill Gaps
            </span>
            <span className="text-xl font-bold text-rose-600">
              {skillGapReport?.total_gaps_identified}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
              Completed Trainings
            </span>
            <span className="text-xl font-bold text-indigo-600">
              {enrollments.filter((e) => e.enrollment_status === "COMPLETED").length}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        {[
          { id: "skills", label: "Skill Gap Diagnostics", icon: Cpu },
          { id: "prediction", label: "Attrition Risk & ML", icon: Brain },
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
                  ? "border-indigo-600 text-indigo-750 text-indigo-650 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Job Role Skill Requirements vs. Current Proficiency</h3>
                <p className="text-xs text-slate-600">
                  Target profile for: <span className="text-indigo-700 font-semibold">{employee.job_role?.title}</span>
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {skillGapReport?.critical_gaps_count} Critical Gaps Identified
              </span>
            </div>

            <div className="space-y-4">
              {skillGapReport?.gaps.map((item) => (
                <div key={item.skill_id} className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800">{item.skill_name}</span>
                      {item.mandatory && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                          Mandatory
                        </span>
                      )}
                      <span className="text-xs text-slate-500">({item.skill_category})</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        Current: <strong className="text-slate-800">{item.current_proficiency}/5</strong> • Target: <strong className="text-slate-800">{item.required_proficiency}/5</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          item.severity === "CRITICAL"
                            ? "bg-purple-50 text-purple-700 border border-purple-100"
                            : item.severity === "HIGH"
                            ? "bg-rose-50 text-rose-700 border border-rose-100"
                            : item.severity === "MEDIUM"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}
                      >
                        {item.severity === "NONE" ? "Proficient" : `${item.severity} GAP (-${item.gap})`}
                      </span>
                    </div>
                  </div>

                  {/* Progress visual comparison */}
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${item.gap > 0 ? "bg-indigo-650 bg-indigo-600" : "bg-emerald-500"}`}
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-indigo-600" /> Machine Learning Attrition Risk Prediction
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Gradient Boosting Classifier with multi-variate feature analysis and transparent explanations.
                </p>
              </div>
              <button
                onClick={handleRunPrediction}
                disabled={predicting}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {predicting ? "Running..." : "Re-evaluate Risk Model"}
              </button>
            </div>

            {prediction ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Predicted Risk Level</span>
                    <span className="text-2xl font-bold text-rose-600 mt-1 block">{prediction.risk_level}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Attrition Probability Score</span>
                    <span className="text-2xl font-bold text-indigo-600 mt-1 block">{Number(prediction.prediction_score).toFixed(1)}%</span>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Inference Date</span>
                    <span className="text-sm font-semibold text-slate-800 mt-2 block">{new Date(prediction.generated_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Explanation factors */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Model Contributing Factors & Explainability</h4>
                  <div className="space-y-2">
                    {prediction.contributing_factors.map((f, i) => (
                      <div
                        key={i}
                        className={`p-3.5 rounded-lg border flex items-center justify-between ${
                          f.impact === "NEGATIVE"
                            ? "bg-rose-50 border-rose-100"
                            : "bg-emerald-50 border-emerald-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {f.impact === "NEGATIVE" ? (
                            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          )}
                          <span className="text-sm text-slate-800">{f.description}</span>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            f.impact === "NEGATIVE" ? "text-rose-700" : "text-emerald-700"
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
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <Sparkles className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-sm text-slate-700 font-semibold">No live prediction generated yet.</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">Click below to trigger real-time AI risk evaluation.</p>
                <button
                  onClick={handleRunPrediction}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
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
            <div key={rev.id} className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{rev.review_period} Review</h4>
                  <p className="text-xs text-slate-500">Date: {new Date(rev.review_date).toLocaleDateString()} • Cycle: {rev.review_cycle}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-indigo-600">{rev.performance_score}/100</span>
                  <p className="text-xs text-slate-500">Rating: {rev.overall_rating} / 5 Stars</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong className="text-emerald-700 block mb-1">Key Strengths</strong>
                  <p className="text-slate-700">{rev.strengths || "Consistently meets engineering targets."}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong className="text-amber-700 block mb-1">Areas for Development</strong>
                  <p className="text-slate-700">{rev.improvement_areas || "Upskilling in modern architectural stacks."}</p>
                </div>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No performance reviews recorded.</p>}
        </div>
      )}

      {/* TAB CONTENT: Training */}
      {activeTab === "training" && (
        <div className="space-y-4">
          {enrollments.map((en) => (
            <div key={en.id} className="p-5 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-sm">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{en.training_course?.title || "Course"}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code: {en.training_course?.course_code} • Provider: {en.training_course?.provider} • Duration: {en.training_course?.duration_hours} hrs
                </p>
                <p className="text-xs text-slate-400 mt-1">Enrolled on {new Date(en.enrollment_date).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {en.enrollment_status}
                </span>
                {en.completion_score && (
                  <p className="text-xs font-bold text-emerald-600 mt-1">Score: {en.completion_score}%</p>
                )}
              </div>
            </div>
          ))}
          {enrollments.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No training courses enrolled.</p>}
        </div>
      )}

      {/* TAB CONTENT: Recommendations */}
      {activeTab === "recommendations" && (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                    {rec.recommendation_type}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      rec.priority === "CRITICAL" || rec.priority === "HIGH"
                        ? "bg-rose-50 text-rose-700 border border-rose-100"
                        : "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}
                  >
                    {rec.priority} Priority
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={rec.status}
                    onChange={(e) => handleUpdateRecStatus(rec.id, e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none shadow-sm"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="ACCEPTED">ACCEPTED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-900">{rec.title}</h4>
              <p className="text-sm text-slate-600 mt-1">{rec.description}</p>
              {rec.action_plan && (
                <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <strong className="text-indigo-700 block mb-1">Recommended Action Plan</strong>
                  {rec.action_plan}
                </div>
              )}
            </div>
          ))}
          {recommendations.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No recommendation action plans created.</p>
          )}
        </div>
      )}

      {/* TAB CONTENT: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 bg-white space-y-4 text-sm shadow-sm">
            <h4 className="font-bold text-slate-800 text-base">Contact & Identity</h4>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-semibold">Official Email</span>
              <span className="text-slate-800">{employee.official_email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-semibold">Phone Number</span>
              <span className="text-slate-800">{employee.phone_number}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-semibold">Work Location</span>
              <span className="text-slate-800">{employee.work_location}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-semibold">Employment Type</span>
              <span className="text-slate-800">{employee.employment_type}</span>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 bg-white space-y-4 text-sm shadow-sm">
            <h4 className="font-bold text-slate-800 text-base">Organization & Hierarchy</h4>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-semibold">Department</span>
              <span className="text-slate-800">{employee.department?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-semibold">Job Role</span>
              <span className="text-slate-800">{employee.job_role?.title} (Grade {employee.job_role?.grade_level})</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-semibold">Reporting Manager</span>
              <span className="text-slate-800">{employee.manager ? `${employee.manager.first_name} ${employee.manager.last_name}` : "None"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
