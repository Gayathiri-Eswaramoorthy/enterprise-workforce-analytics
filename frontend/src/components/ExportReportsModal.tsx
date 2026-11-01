import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, X, Check, ShieldCheck, Cpu, Activity } from "lucide-react";
import {
  exportDepartmentSkillGaps,
  exportAttritionRiskSummary,
  exportComplianceAuditLogs,
  type DeptSkillGapExportData,
  type AuditLogExportItem,
} from "../utils/exportReports";
import type { Department, EmployeeListItem } from "../types";
import api from "../services/api";

interface ExportReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments?: Department[];
  employees?: EmployeeListItem[];
}

type ReportType = "SKILL_GAPS" | "ATTRITION_RISK" | "AUDIT_LOGS";

export const ExportReportsModal: React.FC<ExportReportsModalProps> = ({
  isOpen,
  onClose,
  departments = [],
  employees = [],
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType>("SKILL_GAPS");
  const [selectedFormat, setSelectedFormat] = useState<"csv" | "pdf">("csv");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      if (selectedReport === "SKILL_GAPS") {
        // Fetch fresh department gap stats if not already supplied
        const deptExportData: DeptSkillGapExportData[] = await Promise.all(
          departments.map(async (d) => {
            let criticalGaps = 0;
            try {
              const res = await api.get(`/analytics/skill-gaps/department/${d.id}`);
              criticalGaps = res.data.critical_gaps || 0;
            } catch {
              // fallback gracefully
            }
            const members = employees.filter((e) => e.department_id === d.id);
            const atRisk = members.filter((e) => e.latest_risk_level === "HIGH" || e.latest_risk_level === "CRITICAL").length;
            const scored = members.filter((e) => e.latest_risk_score != null);
            const avgScore = scored.length
              ? (scored.reduce((acc, curr) => acc + (Number(curr.latest_risk_score) * 100), 0) / scored.length)
              : null;

            return {
              departmentCode: d.department_code,
              departmentName: d.name,
              headcount: members.length,
              atRiskCount: atRisk,
              criticalGapsCount: criticalGaps,
              avgProficiencyScore: avgScore,
              status: d.is_active !== false ? "ACTIVE" : "INACTIVE",
            };
          }),
        );

        exportDepartmentSkillGaps(selectedFormat, deptExportData);
        setSuccessMessage(`Department Skill-Gap Matrix successfully generated as ${selectedFormat.toUpperCase()}.`);
      } else if (selectedReport === "ATTRITION_RISK") {
        // Fetch all employees if empty
        let empList = employees;
        if (empList.length === 0) {
          const res = await api.get("/employees", { params: { page_size: 100 } });
          empList = res.data.items || [];
        }

        exportAttritionRiskSummary(selectedFormat, empList, {
          version: "v2.0.0-ibm",
          algorithm: "Random Forest Classifier",
          accuracy: 0.78,
        });
        setSuccessMessage(`Attrition Risk Summary successfully generated as ${selectedFormat.toUpperCase()}.`);
      } else if (selectedReport === "AUDIT_LOGS") {
        // Fetch compliance audit logs from backend
        const res = await api.get("/audit-logs", { params: { page: 1, page_size: 100 } });
        const logs: AuditLogExportItem[] = res.data.items || [];

        exportComplianceAuditLogs(selectedFormat, logs);
        setSuccessMessage(`Compliance Audit Log successfully generated as ${selectedFormat.toUpperCase()}.`);
      }
    } catch (err) {
      console.error("Export error", err);
      alert("Failed to export report. Please verify your connection or try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-[560px] rounded-xl border border-rule bg-panel p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-rule pb-4">
          <div>
            <h2 className="text-[18px] font-bold text-ink">Export Workforce Analytics Reports</h2>
            <p className="text-[13px] text-ink-2 mt-0.5">
              Generate standardized CSV data spreadsheets or formatted, print-ready PDF audit reports.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-5 pt-4">
          {/* Report Type Selector */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-ink-3 mb-2">
              Select Report Category
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setSelectedReport("SKILL_GAPS")}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  selectedReport === "SKILL_GAPS"
                    ? "border-accent bg-accent-soft ring-1 ring-accent"
                    : "border-rule bg-panel hover:bg-sunken"
                }`}
              >
                <Cpu className={`h-5 w-5 mb-2 ${selectedReport === "SKILL_GAPS" ? "text-link" : "text-ink-3"}`} />
                <span className="text-[13px] font-semibold text-ink leading-tight">Skill-Gap Matrix</span>
                <span className="text-[11px] text-ink-3 mt-1">Role requirements vs capability</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReport("ATTRITION_RISK")}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  selectedReport === "ATTRITION_RISK"
                    ? "border-accent bg-accent-soft ring-1 ring-accent"
                    : "border-rule bg-panel hover:bg-sunken"
                }`}
              >
                <Activity className={`h-5 w-5 mb-2 ${selectedReport === "ATTRITION_RISK" ? "text-link" : "text-ink-3"}`} />
                <span className="text-[13px] font-semibold text-ink leading-tight">Attrition Risk</span>
                <span className="text-[11px] text-ink-3 mt-1">Predictive scores & drivers</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReport("AUDIT_LOGS")}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  selectedReport === "AUDIT_LOGS"
                    ? "border-accent bg-accent-soft ring-1 ring-accent"
                    : "border-rule bg-panel hover:bg-sunken"
                }`}
              >
                <ShieldCheck className={`h-5 w-5 mb-2 ${selectedReport === "AUDIT_LOGS" ? "text-link" : "text-ink-3"}`} />
                <span className="text-[13px] font-semibold text-ink leading-tight">Compliance Log</span>
                <span className="text-[11px] text-ink-3 mt-1">System audit & operations</span>
              </button>
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-ink-3 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all ${
                  selectedFormat === "csv"
                    ? "border-accent bg-accent-soft text-ink font-semibold"
                    : "border-rule bg-panel text-ink-2 hover:bg-sunken"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={selectedFormat === "csv"}
                  onChange={() => setSelectedFormat("csv")}
                  className="sr-only"
                />
                <FileSpreadsheet className={`h-5 w-5 ${selectedFormat === "csv" ? "text-link" : "text-ink-3"}`} />
                <div>
                  <div className="text-[13px]">CSV Spreadsheet</div>
                  <div className="text-[11px] font-normal text-ink-3">Compatible with Excel & Sheets</div>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all ${
                  selectedFormat === "pdf"
                    ? "border-accent bg-accent-soft text-ink font-semibold"
                    : "border-rule bg-panel text-ink-2 hover:bg-sunken"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={selectedFormat === "pdf"}
                  onChange={() => setSelectedFormat("pdf")}
                  className="sr-only"
                />
                <FileText className={`h-5 w-5 ${selectedFormat === "pdf" ? "text-link" : "text-ink-3"}`} />
                <div>
                  <div className="text-[13px]">Formatted PDF Report</div>
                  <div className="text-[11px] font-normal text-ink-3">Executive layout with KPI cards</div>
                </div>
              </label>
            </div>
          </div>

          {/* Success indicator */}
          {successMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-[12.5px] text-emerald-800 animate-in fade-in">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-rule pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-rule px-4 py-2 text-[13px] font-medium text-ink hover:bg-sunken transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleExport}
              className="btn btn-primary inline-flex items-center gap-2 px-5 py-2 text-[13px]"
            >
              <Download className="h-4 w-4" />
              {loading ? "Generating..." : `Download ${selectedFormat.toUpperCase()} Report`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
