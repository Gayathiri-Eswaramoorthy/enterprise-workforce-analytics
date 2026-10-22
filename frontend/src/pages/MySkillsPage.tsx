import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { EmployeeDetail, EmployeeSkillGapReport } from "../types";
import {
  Award,
  Clock,
  HelpCircle,
  Layers,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { SkillGapList } from "../components/SkillGapList";

export const MySkillsPage: React.FC = () => {
  const { user } = useAuth();
  const employeeId = user?.employee_id ?? null;

  const [profile, setProfile] = useState<EmployeeDetail | null>(null);
  const [gaps, setGaps] = useState<EmployeeSkillGapReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, gapsRes] = await Promise.all([
        api.get("/employees/me"),
        api.get(`/analytics/skill-gaps/employee/${employeeId}`),
      ]);
      setProfile(profileRes.data);
      setGaps(gapsRes.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load personal skills profile."));
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
          <p className="text-sm font-medium text-ink-3">Loading skills & competencies...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
        <p className="font-medium">{error || "No employee record linked to your user account."}</p>
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

  const matchPercent = gaps ? Math.round(gaps.overall_skill_match_percentage) : 100;
  const employeeSkills = profile.employee_skills || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">My Skills</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
              <Layers className="h-3 w-3" />
              {profile.job_role?.title || "Staff"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-3">
            Personal competency inventory, proficiency levels, and role alignment requirements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/my-requests"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-panel px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-sm hover:bg-sunken hover:text-ink"
          >
            <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
            Request Discussion
          </Link>
          <Link
            to="/my-learning"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Explore Courses
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Role Match % */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Role Competency Match</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{matchPercent}%</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Target benchmark</span>
            <span className="font-medium text-emerald-600">80%+ target</span>
          </div>
        </div>

        {/* Acquired Skills Count */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Verified Skills</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{employeeSkills.length}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>In personal portfolio</span>
            <span className="text-accent font-medium">{employeeSkills.filter((s) => s.certification_status).length} certified</span>
          </div>
        </div>

        {/* Required Role Skills */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Role Requirements</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {gaps?.total_required_skills ?? 0}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Mandatory competencies</span>
            <span className="text-ink-2 font-medium">{profile.job_role?.title}</span>
          </div>
        </div>

        {/* Critical Gaps */}
        <div className="rounded-xl border border-rule bg-panel p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Identified Skill Gaps</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <HelpCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {gaps?.skills_with_gap ?? 0}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>Opportunities for growth</span>
            <span className={gaps?.critical_gaps_count ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"}>
              {gaps?.critical_gaps_count ? `${gaps.critical_gaps_count} critical` : "All clear"}
            </span>
          </div>
        </div>
      </div>

      {/* Role Competency Alignment & Gaps */}
      <div className="rounded-xl border border-rule bg-panel p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Role Requirements & Proficiency Gaps</h2>
            <p className="text-xs text-ink-3">
              Direct comparison between required proficiencies for your job title and your current verified skills.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <SkillGapList gaps={gaps?.gaps || []} />
        </div>
      </div>

      {/* Verified Skills Portfolio */}
      <div className="rounded-xl border border-rule bg-panel p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Verified Skill Portfolio</h2>
            <p className="text-xs text-ink-3">
              Full inventory of your registered technical, operational, and domain proficiencies.
            </p>
          </div>
        </div>

        {employeeSkills.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-3">No skills currently registered.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {employeeSkills.map((es) => (
              <div key={es.id} className="rounded-lg border border-rule bg-sunken p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{es.skill?.name || "Skill"}</p>
                  {es.certification_status && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      <Award className="h-3 w-3" /> Certified
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink-3">{es.skill?.skill_category || "General"}</p>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span
                        key={lvl}
                        className={`h-2 w-4 rounded-sm ${
                          lvl <= es.proficiency_level ? "bg-accent" : "bg-rule"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-ink">Level {es.proficiency_level}/5</span>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-3 border-t border-rule/60 pt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {es.years_of_experience ? `${es.years_of_experience} yrs exp` : "< 1 yr"}
                  </span>
                  {es.last_assessed_date && (
                    <span>Assessed {new Date(es.last_assessed_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
