import React from "react";
import type { RiskLevel } from "../types";
import { RISK_COLOR, RISK_LABEL } from "../lib/risk";

interface RiskMeterProps {
  level?: RiskLevel | null;
  score?: number | null;
  /** Stacked score-over-level layout for narrow rows */
  compact?: boolean;
  /** Grow-in delay, ms */
  delay?: number;
}

/** Inline risk reading for rows: a thin track filled to the score, the score, and the level in words. */
export const RiskMeter: React.FC<RiskMeterProps> = ({ level, score, compact = false, delay = 0 }) => {
  if (!level || score == null) {
    return <span className="text-xs text-ink-3">Not assessed</span>;
  }
  const meter = (
    <span
      className={`relative h-1.5 flex-shrink-0 overflow-hidden rounded-full bg-sunken ${compact ? "w-11" : "w-16"}`}
      aria-hidden="true"
    >
      <span
        className="grow absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.max(6, Math.min(100, score))}%`,
          backgroundColor: RISK_COLOR[level],
          animationDelay: `${delay}ms`,
        }}
      />
    </span>
  );

  if (compact) {
    return (
      <span className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-2">
          {meter}
          <span className="text-[13px] font-semibold text-ink">{Math.round(score)}%</span>
        </span>
        <span className="text-xs text-ink-3">{RISK_LABEL[level]}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2.5">
      {meter}
      <span className="w-9 text-right text-[13px] font-semibold tabular-nums text-ink">{Math.round(score)}%</span>
      <span className="w-12 text-left text-xs text-ink-2">{RISK_LABEL[level]}</span>
    </span>
  );
};
