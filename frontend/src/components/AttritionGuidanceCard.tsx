import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import api, { getErrorMessage } from "../services/api";

export interface AttritionGuidanceSubject {
  case_ref: string;
  department: string;
  role: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  probability: number;
  drivers: string[];
}

export const AttritionGuidanceCard: React.FC<{ employees: AttritionGuidanceSubject[] }> = ({ employees }) => {
  const [guidance, setGuidance] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/analytics/attrition-guidance", { employees: employees.slice(0, 8) });
      setGuidance(response.data.guidance);
    } catch (err) {
      setError(getErrorMessage(err, "Could not generate suggestions. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card overflow-hidden" aria-labelledby="ai-guidance-title">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-link">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="ai-guidance-title" className="text-[15px] font-semibold text-ink">AI-assisted HR follow-up</h2>
            <p className="mt-1 max-w-3xl text-[13px] text-ink-2">
              Draft supportive next steps from the current risk signals for HR to review. Risk estimates are uncertain; confirm context with each employee.
            </p>
            {employees.length === 0 && <p className="mt-2 text-xs text-ink-3">No high or critical risk records are available to review right now.</p>}
          </div>
        </div>
        <button type="button" onClick={generate} disabled={loading || employees.length === 0} className="btn btn-primary shrink-0">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {loading ? "Generating…" : guidance ? "Regenerate suggestions" : "Generate suggestions"}
        </button>
      </div>
      {loading && <div className="mx-5 mb-5 skeleton h-20 sm:mx-6" aria-label="Generating suggestions" />}
      {error && <p role="alert" className="mx-5 mb-5 rounded-lg bg-risk-critical/10 p-3 text-[13px] text-risk-critical sm:mx-6">{error}</p>}
      {guidance && !loading && <div className="mx-5 mb-5 whitespace-pre-wrap rounded-xl bg-sunken p-4 text-[13px] leading-6 text-ink sm:mx-6">{guidance}</div>}
      <div className="border-t border-rule-soft px-5 py-2.5 text-[11px] text-ink-3 sm:px-6">
        Uses up to {Math.min(employees.length, 8)} pseudonymous risk records. Suggestions are drafts, not employment decisions.
      </div>
    </section>
  );
};
