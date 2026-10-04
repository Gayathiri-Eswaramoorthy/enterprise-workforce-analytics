import React from "react";
import type { RiskLevel } from "../types";

const STYLES: Record<RiskLevel, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-purple-50 text-purple-700 border-purple-100" },
  HIGH: { label: "High Risk", className: "bg-rose-50 text-rose-700 border-rose-100" },
  MEDIUM: { label: "Medium", className: "bg-amber-50 text-amber-700 border-amber-100" },
  LOW: { label: "Low Risk", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
};

interface RiskBadgeProps {
  level?: RiskLevel | null;
  score?: number | null;
}

/** Attrition risk pill. Employees never scored by the model show "Not assessed", not "Low". */
export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, score }) => {
  if (!level || !STYLES[level]) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
        Not assessed
      </span>
    );
  }
  const { label, className } = STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${className}`}>
      {label}
      {score != null && <span className="font-normal opacity-75">· {Math.round(score)}%</span>}
    </span>
  );
};
