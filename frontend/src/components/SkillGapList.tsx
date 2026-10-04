import React from "react";
import type { SkillGapItem } from "../types";

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-purple-50 text-purple-700 border-purple-100",
  HIGH: "bg-rose-50 text-rose-700 border-rose-100",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-100",
  NONE: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

/** Role requirement vs. current proficiency, one bar per required skill. */
export const SkillGapList: React.FC<{ gaps: SkillGapItem[] }> = ({ gaps }) => {
  if (gaps.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No skill requirements defined for this role.</p>;
  }

  return (
    <div className="space-y-4">
      {gaps.map((item) => (
        <div key={item.skill_id} className="p-4 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-slate-800">{item.skill_name}</span>
              {item.is_mandatory && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                  Mandatory
                </span>
              )}
              <span className="text-xs text-slate-500">({item.skill_category})</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Current: <strong className="text-slate-800">{item.current_proficiency}/5</strong> • Target:{" "}
                <strong className="text-slate-800">{item.required_proficiency}/5</strong>
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${SEVERITY_STYLE[item.severity] ?? SEVERITY_STYLE.NONE}`}>
                {item.severity === "NONE" ? "Proficient" : `${item.severity} GAP (-${item.gap})`}
              </span>
            </div>
          </div>

          {/* Current proficiency bar, with a marker at the role's target level */}
          <div
            className="relative h-2 w-full bg-slate-200 rounded-full"
            role="meter"
            aria-label={`${item.skill_name} proficiency`}
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={item.current_proficiency}
          >
            <div
              className={`h-full rounded-full ${item.gap > 0 ? "bg-indigo-600" : "bg-emerald-500"}`}
              style={{ width: `${(item.current_proficiency / 5) * 100}%` }}
            />
            {item.gap > 0 && (
              <div
                className="absolute -top-1 h-4 w-0.5 bg-slate-700"
                style={{ left: `calc(${(item.required_proficiency / 5) * 100}% - 1px)` }}
                title={`Target: ${item.required_proficiency}/5`}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
