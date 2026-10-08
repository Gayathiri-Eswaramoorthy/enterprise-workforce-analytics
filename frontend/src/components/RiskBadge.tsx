import React from "react";
import type { RiskLevel } from "../types";
import { RISK_COLOR, RISK_LABEL, isRiskLevel } from "../lib/risk";

interface RiskBadgeProps {
  level?: RiskLevel | null;
  score?: number | null;
}

/**
 * Compact attrition-risk label: a scale-coloured mark plus the level in words.
 * Employees never scored by the model show "Not assessed", not "Low".
 */
export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, score }) => {
  if (!isRiskLevel(level)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-rule px-2 py-0.5 text-xs text-ink-3">
        Not assessed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-panel px-2 py-0.5 text-xs font-medium text-ink">
      <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: RISK_COLOR[level] }} aria-hidden="true" />
      {RISK_LABEL[level]}
      {score != null && <span className="font-normal tabular-nums text-ink-3">{Math.round(score)}%</span>}
    </span>
  );
};
