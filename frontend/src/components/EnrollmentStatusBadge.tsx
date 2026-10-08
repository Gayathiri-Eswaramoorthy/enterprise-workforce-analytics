import React from "react";
import type { EnrollmentStatus } from "../types";

const TONE: Record<EnrollmentStatus, string> = {
  ENROLLED: "var(--accent)",
  IN_PROGRESS: "var(--risk-medium)",
  COMPLETED: "var(--risk-low)",
  FAILED: "var(--risk-critical)",
  DROPPED: "var(--ink-3)",
};

const LABEL: Record<EnrollmentStatus, string> = {
  ENROLLED: "Enrolled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  DROPPED: "Dropped",
};

export const ENROLLMENT_TONE = TONE;
export const ENROLLMENT_LABEL = LABEL;

export const EnrollmentStatusBadge: React.FC<{ status: EnrollmentStatus }> = ({ status }) => {
  const tone = TONE[status] ?? TONE.ENROLLED;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} aria-hidden="true" />
      {LABEL[status] ?? status}
    </span>
  );
};
