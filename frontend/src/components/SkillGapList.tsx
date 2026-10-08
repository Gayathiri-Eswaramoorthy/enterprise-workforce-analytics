import React from "react";
import type { SkillGapItem } from "../types";

const SEVERITY_TONE: Record<string, string> = {
  CRITICAL: "var(--risk-critical)",
  HIGH: "var(--risk-high)",
  MEDIUM: "var(--risk-medium)",
  NONE: "var(--risk-low)",
};

/** Role requirement vs. current proficiency, one bar per required skill. */
export const SkillGapList: React.FC<{ gaps: SkillGapItem[] }> = ({ gaps }) => {
  if (gaps.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-3">No skill requirements defined for this role.</p>;
  }

  return (
    <div className="space-y-3">
      {gaps.map((item) => {
        const tone = SEVERITY_TONE[item.severity] ?? SEVERITY_TONE.NONE;
        return (
          <div key={item.skill_id} className="well p-4">
            <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{item.skill_name}</span>
                {item.is_mandatory && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{
                      color: "var(--risk-critical)",
                      background: "color-mix(in srgb, var(--risk-critical) 10%, transparent)",
                    }}
                  >
                    Mandatory
                  </span>
                )}
                <span className="text-xs text-ink-3">({item.skill_category})</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-2">
                  Current: <strong className="text-ink">{item.current_proficiency}/5</strong> • Target:{" "}
                  <strong className="text-ink">{item.required_proficiency}/5</strong>
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}
                >
                  {item.severity === "NONE" ? "Proficient" : `${item.severity} GAP (-${item.gap})`}
                </span>
              </div>
            </div>

            {/* Current proficiency bar, with a marker at the role's target level */}
            <div
              className="relative h-2 w-full rounded-full bg-rule"
              role="meter"
              aria-label={`${item.skill_name} proficiency`}
              aria-valuemin={0}
              aria-valuemax={5}
              aria-valuenow={item.current_proficiency}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.current_proficiency / 5) * 100}%`,
                  background: item.gap > 0 ? "var(--accent)" : "var(--risk-low)",
                }}
              />
              {item.gap > 0 && (
                <div
                  className="absolute -top-1 h-4 w-0.5 bg-ink"
                  style={{ left: `calc(${(item.required_proficiency / 5) * 100}% - 1px)` }}
                  title={`Target: ${item.required_proficiency}/5`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
