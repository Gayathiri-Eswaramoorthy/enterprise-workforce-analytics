import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { RiskLevel } from "../types";
import { RISK_COLOR, RISK_LABEL, RISK_LEVELS, type RiskCounts } from "../lib/risk";
import { AnimatedCounter } from "./AnimatedCounter";

interface RiskStripProps {
  counts: RiskCounts;
  /** "lg": the summary bar with pie chart and filter cards; "sm": a department row */
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

/**
 * Attrition risk representation:
 * - When size="lg": Pie chart on the left side, and Low, Med, High, Crit interactive cards on the right side.
 * - When size="sm": Compact segmented bar for departments.
 */
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

  const pieData = RISK_LEVELS.map((level) => ({
    name: RISK_LABEL[level],
    level,
    value: counts[level],
    percentage: total > 0 ? Math.round(pct(counts[level], total)) : 0,
  }));

  if (large) {
    return (
      <div className="w-full">
        {/* Subtle horizontal mini indicator bar at the top */}
        <div
          role="img"
          aria-label={`${label}: ${summary || "no one scored"}`}
          className={`relative mb-6 flex h-2 w-full overflow-hidden rounded-full ${
            scanning ? "sweeping" : ""
          }`}
          onMouseLeave={() => setHovered(null)}
        >
          {total === 0 && <div className="h-full w-full bg-sunken" />}
          <div className="grow flex h-full w-full gap-[2px]">
            {present.map((level) => {
              const dimmed = hovered !== null ? hovered !== level : !isOn(level);
              return (
                <div
                  key={level}
                  onMouseEnter={() => setHovered(level)}
                  onClick={onSelect ? () => onSelect(level) : undefined}
                  className={`relative h-full transition-[flex-grow,opacity] duration-500 ease-out-expo ${
                    onSelect ? "cursor-pointer" : ""
                  }`}
                  style={{
                    flexGrow: counts[level],
                    flexBasis: 0,
                    backgroundColor: RISK_COLOR[level],
                    opacity: dimmed ? 0.35 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Main Layout: Pie Chart on Left Side, Low/Med/High/Crit on Right Side */}
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
          {/* Left Side: Pie Chart */}
          <div className="relative flex flex-col items-center justify-center md:col-span-5">
            <div className="relative h-48 w-full max-w-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={3}
                    stroke="var(--bg-panel, #ffffff)"
                    strokeWidth={2}
                    cursor="pointer"
                    onClick={(entry: any) => onSelect?.(entry.level)}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.level}
                        fill={RISK_COLOR[entry.level]}
                        opacity={
                          hovered !== null
                            ? hovered === entry.level
                              ? 1
                              : 0.35
                            : !isOn(entry.level)
                            ? 0.35
                            : 1
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border border-rule bg-panel p-2 shadow-lg text-xs">
                            <span className="font-semibold text-ink">{d.name}: </span>
                            <span className="font-bold text-accent">{d.value}</span> ({d.percentage}%)
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Headcount Stat */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tracking-tight text-ink tabular-nums">
                  <AnimatedCounter value={total} duration={800} />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                  People
                </span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-ink-3 text-center">
              Click slice or cards to filter
            </p>
          </div>

          {/* Right Side: Low, Med, High, Crit 2x2 Interactive Grid */}
          <div className="grid grid-cols-2 gap-3 md:col-span-7">
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
                  className={`rounded-xl border p-4 text-left transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${
                    pressed
                      ? "border-accent bg-accent-soft/70 shadow-xs ring-2 ring-accent/20"
                      : "border-rule bg-panel hover:border-rule-strong hover:bg-hover hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-ink-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: RISK_COLOR[level] }}
                        aria-hidden="true"
                      />
                      {RISK_LABEL[level]}
                    </span>
                    <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">
                      {Math.round(pct(counts[level], total))}%
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-2xl font-bold leading-none tracking-tight text-ink tabular-nums">
                      <AnimatedCounter value={counts[level]} duration={900} />
                    </span>
                    <span className="text-[11px] text-ink-3">employees</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Small size for department rows
  return (
    <div className="w-full">
      <div
        role="img"
        aria-label={`${label}: ${summary || "no one scored"}`}
        className={`relative flex w-full overflow-hidden rounded-[4px] h-1.5 gap-[2px] ${
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
    </div>
  );
};
