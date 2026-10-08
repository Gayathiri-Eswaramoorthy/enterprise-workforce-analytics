import React, { useState } from "react";
import type { RiskLevel } from "../types";
import { RISK_COLOR, RISK_LABEL, RISK_LEVELS, numberFormat, type RiskCounts } from "../lib/risk";

interface RiskStripProps {
  counts: RiskCounts;
  /** "lg": the summary bar with a row of filter tiles; "sm": a department row */
  size?: "lg" | "sm";
  /** Levels switched on as a filter; the others recede */
  selected?: RiskLevel[];
  /** Toggle one level on or off */
  onSelect?: (level: RiskLevel) => void;
  /** Grow-in delay, ms */
  delay?: number;
  /** Model is running: a cyan sweep travels along the bar */
  scanning?: boolean;
  label: string;
}

const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);

/** The workforce as one segmented bar, one segment per risk level. */
export const RiskStrip: React.FC<RiskStripProps> = ({
  counts,
  size = "sm",
  selected,
  onSelect,
  delay = 0,
  scanning = false,
  label,
}) => {
  const [hovered, setHovered] = useState<RiskLevel | null>(null);
  const total = RISK_LEVELS.reduce((sum, level) => sum + counts[level], 0);
  const present = RISK_LEVELS.filter((level) => counts[level] > 0);
  const large = size === "lg";
  const isOn = (level: RiskLevel) => !selected || selected.includes(level);
  const summary = present.map((level) => `${RISK_LABEL[level]} ${counts[level]}`).join(", ");

  return (
    <div className="w-full">
      <div
        role="img"
        aria-label={`${label}: ${summary || "no one scored"}`}
        className={`relative flex w-full overflow-hidden rounded-[4px] ${large ? "h-3 gap-[3px]" : "h-1.5 gap-[2px]"} ${
          scanning ? "sweeping" : ""
        }`}
        onMouseLeave={() => setHovered(null)}
      >
        {total === 0 && <div className="h-full w-full bg-sunken" />}
        <div className="grow flex h-full w-full gap-[inherit]" style={{ animationDelay: `${delay}ms` }}>
          {present.map((level) => {
            const dimmed = hovered !== null ? hovered !== level : !isOn(level);
            return (
              <div
                key={level}
                onMouseEnter={() => setHovered(level)}
                onClick={onSelect ? () => onSelect(level) : undefined}
                className={`relative h-full rounded-[3px] transition-[flex-grow,opacity] duration-500 ease-out-expo ${
                  onSelect ? "cursor-pointer" : ""
                }`}
                style={{
                  flexGrow: counts[level],
                  flexBasis: 0,
                  backgroundColor: RISK_COLOR[level],
                  opacity: dimmed ? 0.45 : 1,
                }}
              />
            );
          })}
        </div>
      </div>

      {large && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RISK_LEVELS.map((level) => {
            const pressed = Boolean(selected?.includes(level));
            return (
              <button
                key={level}
                type="button"
                aria-pressed={pressed}
                disabled={!onSelect || counts[level] === 0}
                onClick={() => onSelect?.(level)}
                onMouseEnter={() => setHovered(level)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(level)}
                onBlur={() => setHovered(null)}
                className={`rounded-lg border px-4 py-4 text-left transition-[background-color,border-color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${
                  pressed
                    ? "border-accent bg-accent-soft"
                    : "border-rule bg-panel hover:border-rule-strong hover:bg-hover"
                }`}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                  <span
                    className="h-2 w-2 rounded-[2px]"
                    style={{ backgroundColor: RISK_COLOR[level] }}
                    aria-hidden="true"
                  />
                  {RISK_LABEL[level]}
                </span>
                <span className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[28px] font-semibold leading-none tracking-[-0.025em] text-ink">
                    {numberFormat.format(counts[level])}
                  </span>
                  <span className="text-xs text-ink-3">{Math.round(pct(counts[level], total))}%</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
