import type { RiskLevel } from "../types";

/** Ordered low → critical. The order is meaningful: strips and legends always follow it. */
export const RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

/** CSS custom properties from index.css; use for inline SVG/style fills. */
export const RISK_COLOR: Record<RiskLevel, string> = {
  LOW: "var(--risk-low)",
  MEDIUM: "var(--risk-medium)",
  HIGH: "var(--risk-high)",
  CRITICAL: "var(--risk-critical)",
};

export const AT_RISK_LEVELS: RiskLevel[] = ["HIGH", "CRITICAL"];

export const isRiskLevel = (value: unknown): value is RiskLevel =>
  typeof value === "string" && (RISK_LEVELS as string[]).includes(value);

export type RiskCounts = Record<RiskLevel, number>;

export const emptyCounts = (): RiskCounts => ({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });

export const countByLevel = <T>(items: T[], levelOf: (item: T) => RiskLevel | null | undefined): RiskCounts => {
  const counts = emptyCounts();
  for (const item of items) {
    const level = levelOf(item);
    if (level) counts[level] += 1;
  }
  return counts;
};

export const numberFormat = new Intl.NumberFormat(undefined);
