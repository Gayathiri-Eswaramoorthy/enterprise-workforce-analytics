import React from "react";
import type { EnrollmentStatus } from "../types";

const STYLES: Record<EnrollmentStatus, string> = {
  ENROLLED: "bg-indigo-50 text-indigo-700 border-indigo-100",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  FAILED: "bg-rose-50 text-rose-700 border-rose-100",
  DROPPED: "bg-slate-50 text-slate-500 border-slate-200",
};

export const EnrollmentStatusBadge: React.FC<{ status: EnrollmentStatus }> = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold border ${STYLES[status] ?? STYLES.ENROLLED}`}>
    {status.replace("_", " ")}
  </span>
);
