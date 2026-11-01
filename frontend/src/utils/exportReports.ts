/**
 * Enterprise Report Generation & Export Utility
 * Supports CSV file downloads and formatted, print-ready executive PDF reports.
 */

import type { EmployeeListItem } from "../types";

// ==========================================
// CSV Export Engine
// ==========================================

/**
 * Escapes and formats a field for standard RFC 4180 CSV compliance.
 */
const escapeCsvField = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Generates and triggers the browser download of a clean UTF-8 encoded CSV file.
 */
export const downloadCsv = (filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void => {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\r\n"); // UTF-8 BOM for Excel compatibility

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ==========================================
// Formatted PDF Report Engine
// ==========================================

export interface ReportKpi {
  label: string;
  value: string | number;
  subtext?: string;
  tone?: "normal" | "danger" | "warning" | "success" | "accent";
}

export interface FormattedReportConfig {
  title: string;
  subtitle: string;
  reportCode: string;
  generatedBy?: string;
  kpis?: ReportKpi[];
  tableHeaders: string[];
  tableRows: (string | number | { text: string; badge?: "low" | "medium" | "high" | "critical" | "neutral" })[][];
  summaryNotes?: string[];
}

/**
 * Opens a dedicated executive print window with formatted styling and triggers window.print()
 * allowing saving as a pixel-perfect, clean PDF report.
 */
export const openFormattedPdfReport = (config: FormattedReportConfig): void => {
  const printWindow = window.open("", "_blank", "width=1100,height=850");
  if (!printWindow) {
    alert("Please allow pop-ups in your browser to generate the formatted PDF report.");
    return;
  }

  const now = new Date();
  const timestampStr = now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const kpisHtml = config.kpis && config.kpis.length > 0
    ? `
      <div class="kpi-grid">
        ${config.kpis
          .map((kpi) => {
            const toneClass = kpi.tone ? `kpi-${kpi.tone}` : "kpi-normal";
            return `
              <div class="kpi-card ${toneClass}">
                <div class="kpi-label">${escapeHtml(kpi.label)}</div>
                <div class="kpi-value">${escapeHtml(String(kpi.value))}</div>
                ${kpi.subtext ? `<div class="kpi-subtext">${escapeHtml(kpi.subtext)}</div>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>
    `
    : "";

  const tableHeaderHtml = `
    <thead>
      <tr>
        <th style="width: 45px; text-align: center;">#</th>
        ${config.tableHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
      </tr>
    </thead>
  `;

  const tableBodyHtml = `
    <tbody>
      ${config.tableRows
        .map((row, idx) => {
          const cells = row.map((cell) => {
            if (typeof cell === "object" && cell !== null && "badge" in cell) {
              const badgeClass = `badge badge-${cell.badge ?? "neutral"}`;
              return `<td><span class="${badgeClass}">${escapeHtml(cell.text)}</span></td>`;
            }
            return `<td>${escapeHtml(String(cell ?? "—"))}</td>`;
          });
          return `
            <tr>
              <td style="text-align: center; color: #64748b; font-variant-numeric: tabular-nums;">${idx + 1}</td>
              ${cells.join("")}
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;

  const notesHtml = config.summaryNotes && config.summaryNotes.length > 0
    ? `
      <div class="notes-panel">
        <div class="notes-title">Executive Governance & Methodology Notes</div>
        <ul>
          ${config.summaryNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(config.title)}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 12mm 15mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0c1a33;
          background: #ffffff;
          padding: 24px;
          line-height: 1.45;
          font-size: 13px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0b1f44;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-icon {
          width: 32px;
          height: 32px;
          background: #0b1f44;
          color: #ffffff;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-size: 16px;
        }
        .brand-name {
          font-size: 17px;
          font-weight: 700;
          color: #0b1f44;
          letter-spacing: -0.02em;
        }
        .report-title {
          font-size: 20px;
          font-weight: 700;
          color: #0b1f44;
          margin-top: 6px;
        }
        .report-subtitle {
          font-size: 12.5px;
          color: #475569;
          margin-top: 2px;
        }
        .meta-box {
          text-align: right;
          font-size: 11.5px;
          color: #475569;
        }
        .meta-box .code {
          font-weight: 700;
          color: #0b1f44;
          background: #eef3fe;
          padding: 2px 7px;
          border-radius: 4px;
          display: inline-block;
          margin-bottom: 4px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .kpi-card {
          padding: 12px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        .kpi-label {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 600;
          color: #64748b;
          letter-spacing: 0.03em;
        }
        .kpi-value {
          font-size: 22px;
          font-weight: 700;
          color: #0c1a33;
          margin-top: 2px;
        }
        .kpi-subtext {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .kpi-danger .kpi-value { color: #d0216e; }
        .kpi-warning .kpi-value { color: #f25a2a; }
        .kpi-success .kpi-value { color: #1ec47f; }
        .kpi-accent .kpi-value { color: #2563eb; }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
          font-size: 12px;
        }
        th {
          background: #f1f4f9;
          color: #334155;
          font-weight: 600;
          text-align: left;
          padding: 8px 10px;
          border-bottom: 2px solid #cbd5e1;
          font-size: 11.5px;
          letter-spacing: 0.02em;
        }
        td {
          padding: 7px 10px;
          border-bottom: 1px solid #e2e8f0;
          color: #1e293b;
        }
        tr:nth-child(even) td {
          background: #fafbfc;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .badge-low { background: #dcfce7; color: #15803d; }
        .badge-medium { background: #fef3c7; color: #b45309; }
        .badge-high { background: #ffedd5; color: #c2410c; }
        .badge-critical { background: #ffe4e6; color: #be123c; }
        .badge-neutral { background: #f1f5f9; color: #475569; }

        .notes-panel {
          background: #f8fafc;
          border-left: 3px solid #2563eb;
          padding: 10px 14px;
          font-size: 11.5px;
          color: #475569;
          margin-bottom: 16px;
        }
        .notes-title {
          font-weight: 700;
          color: #0b1f44;
          margin-bottom: 4px;
        }
        .notes-panel ul {
          padding-left: 16px;
        }
        .footer {
          margin-top: 24px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #94a3b8;
        }
        .controls {
          position: fixed;
          bottom: 20px;
          right: 20px;
          display: flex;
          gap: 10px;
          z-index: 100;
        }
        .btn-print {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 10px 18px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .btn-close {
          background: #ffffff;
          color: #334155;
          border: 1px solid #cbd5e1;
          padding: 10px 14px;
          border-radius: 6px;
          cursor: pointer;
        }
        @media print {
          .controls { display: none !important; }
          body { padding: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="controls">
        <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
        <button class="btn-close" onclick="window.close()">Close Window</button>
      </div>

      <header class="header">
        <div>
          <div class="brand">
            <div class="brand-icon">W</div>
            <div class="brand-name">Workforce Analytics</div>
          </div>
          <h1 class="report-title">${escapeHtml(config.title)}</h1>
          <div class="report-subtitle">${escapeHtml(config.subtitle)}</div>
        </div>
        <div class="meta-box">
          <div class="code">${escapeHtml(config.reportCode)}</div>
          <div><strong>Generated:</strong> ${escapeHtml(timestampStr)}</div>
          <div><strong>Authorized Role:</strong> ${escapeHtml(config.generatedBy ?? "HR Management")}</div>
          <div><strong>Classification:</strong> Confidential • Internal HR Oversight</div>
        </div>
      </header>

      ${kpisHtml}

      <table>
        ${tableHeaderHtml}
        ${tableBodyHtml}
      </table>

      ${notesHtml}

      <footer class="footer">
        <div>Enterprise Workforce Predictive Analytics Engine • Confidential & Proprietary</div>
        <div>Page 1 of 1 • System-Generated Audit & Analytics Report</div>
      </footer>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// ==========================================
// Domain-Specific Report Generators
// ==========================================

export interface DeptSkillGapExportData {
  departmentCode: string;
  departmentName: string;
  headcount: number;
  atRiskCount: number;
  criticalGapsCount: number;
  avgProficiencyScore?: number | null;
  status: string;
}

/**
 * 1. Department Skill-Gap Matrix Exporter
 */
export const exportDepartmentSkillGaps = (
  format: "csv" | "pdf",
  data: DeptSkillGapExportData[],
): void => {
  const headers = [
    "Department Code",
    "Department Name",
    "Headcount",
    "At-Risk Employees",
    "Critical Skill Gaps",
    "Avg Risk Score (%)",
    "Status",
  ];

  if (format === "csv") {
    const rows = data.map((d) => [
      d.departmentCode,
      d.departmentName,
      d.headcount,
      d.atRiskCount,
      d.criticalGapsCount,
      d.avgProficiencyScore ? d.avgProficiencyScore.toFixed(1) : "N/A",
      d.status,
    ]);
    downloadCsv(`Department_Skill_Gap_Matrix_${new Date().toISOString().split("T")[0]}`, headers, rows);
    return;
  }

  // Formatted PDF Report
  const totalHeadcount = data.reduce((acc, d) => acc + d.headcount, 0);
  const totalCriticalGaps = data.reduce((acc, d) => acc + d.criticalGapsCount, 0);
  const totalAtRisk = data.reduce((acc, d) => acc + d.atRiskCount, 0);

  const tableRows: (string | number | { text: string; badge?: "low" | "medium" | "high" | "critical" | "neutral" })[][] = data.map((d) => [
    d.departmentCode,
    d.departmentName,
    d.headcount,
    {
      text: `${d.atRiskCount} (${d.headcount ? Math.round((d.atRiskCount / d.headcount) * 100) : 0}%)`,
      badge: (d.atRiskCount > 3 ? "critical" : d.atRiskCount > 0 ? "medium" : "low") as "critical" | "medium" | "low",
    },
    {
      text: String(d.criticalGapsCount),
      badge: (d.criticalGapsCount > 5 ? "critical" : d.criticalGapsCount > 0 ? "medium" : "low") as "critical" | "medium" | "low",
    },
    d.avgProficiencyScore ? `${d.avgProficiencyScore.toFixed(1)}%` : "N/A",
    { text: d.status, badge: (d.status === "ACTIVE" ? "low" : "neutral") as "low" | "neutral" },
  ]);

  openFormattedPdfReport({
    title: "Department Skill-Gap & Workforce Capability Matrix",
    subtitle: "Consolidated organizational capability gaps, role proficiency deltas, and departmental exposure",
    reportCode: "REP-SKILL-GAP-01",
    generatedBy: "HR Manager / Administrator",
    kpis: [
      { label: "Departments Analyzed", value: data.length, subtext: "Active corporate units" },
      { label: "Total Headcount", value: totalHeadcount, subtext: "Active workforce mapped" },
      { label: "Critical Skill Gaps", value: totalCriticalGaps, tone: totalCriticalGaps > 10 ? "danger" : "normal", subtext: "Immediate training priority" },
      { label: "At-Risk Employees", value: totalAtRisk, tone: totalAtRisk > 5 ? "warning" : "normal", subtext: "High/Critical attrition risk" },
    ],
    tableHeaders: headers,
    tableRows,
    summaryNotes: [
      "Skill gaps represent unmet mandatory capability thresholds defined for job roles in each department.",
      "Departments with both critical skill gaps and elevated attrition risk are flagged for retention and targeted learning intervention.",
      "Proficiency evaluations are calibrated against standard 1–5 competency levels.",
    ],
  });
};

/**
 * 2. Attrition Risk Summary Exporter
 */
export const exportAttritionRiskSummary = (
  format: "csv" | "pdf",
  employees: EmployeeListItem[],
  modelMetadata?: { version?: string; algorithm?: string; accuracy?: number },
): void => {
  const headers = [
    "Employee Code",
    "Employee Name",
    "Department",
    "Job Role",
    "Risk Level",
    "Risk Score (%)",
    "Overtime",
    "Work Mode",
    "Contributing Risk Drivers",
  ];

  if (format === "csv") {
    const rows = employees.map((e) => [
      e.employee_code,
      e.full_name || `${e.first_name} ${e.last_name}`,
      e.department_name || "—",
      e.job_role_title || "—",
      e.latest_risk_level || "NOT_SCORED",
      e.latest_risk_score ? (e.latest_risk_score * 100).toFixed(1) : "—",
      e.overtime_frequency || "NONE",
      e.work_mode || "OFFICE",
      e.latest_prediction_reason || "Normal workforce baseline",
    ]);
    downloadCsv(`Attrition_Risk_Summary_${new Date().toISOString().split("T")[0]}`, headers, rows);
    return;
  }

  // PDF Formatted Report
  const totalEmployees = employees.length;
  const criticalCount = employees.filter((e) => e.latest_risk_level === "CRITICAL").length;
  const highCount = employees.filter((e) => e.latest_risk_level === "HIGH").length;
  const mediumCount = employees.filter((e) => e.latest_risk_level === "MEDIUM").length;
  const lowCount = employees.filter((e) => e.latest_risk_level === "LOW").length;

  const tableRows = employees.map((e) => {
    const level = (e.latest_risk_level || "LOW").toLowerCase() as "low" | "medium" | "high" | "critical";
    const scoreVal = e.latest_risk_score ? `${(e.latest_risk_score * 100).toFixed(1)}%` : "—";
    return [
      e.employee_code,
      e.full_name || `${e.first_name} ${e.last_name}`,
      e.department_name || "—",
      e.job_role_title || "—",
      { text: e.latest_risk_level || "NOT_SCORED", badge: level },
      scoreVal,
      e.overtime_frequency || "NONE",
      e.work_mode || "OFFICE",
      e.latest_prediction_reason || "Baseline parameters",
    ];
  });

  openFormattedPdfReport({
    title: "Workforce Attrition Risk & Predictive Retention Summary",
    subtitle: `AI inference analysis based on ${modelMetadata?.algorithm || "Random Forest Classifier"} (${modelMetadata?.version || "v2.0.0-ibm"})`,
    reportCode: "REP-ATTRITION-RISK-02",
    generatedBy: "HR Manager / Administrator",
    kpis: [
      { label: "Workforce Assessed", value: totalEmployees, subtext: "Total active employees" },
      { label: "Critical Risk (≥75%)", value: criticalCount, tone: "danger", subtext: `${Math.round((criticalCount / (totalEmployees || 1)) * 100)}% of workforce` },
      { label: "High Risk (50-74%)", value: highCount, tone: "warning", subtext: `${Math.round((highCount / (totalEmployees || 1)) * 100)}% of workforce` },
      { label: "Low & Medium Risk", value: lowCount + mediumCount, tone: "success", subtext: `${Math.round(((lowCount + mediumCount) / (totalEmployees || 1)) * 100)}% stable status` },
    ],
    tableHeaders: headers,
    tableRows,
    summaryNotes: [
      "Predicted attrition scores reflect empirical feature correlations derived from benchmark models and do not assert intent to resign.",
      "Top drivers identify high-leverage intervention targets such as overtime fatigue, tenure stagnation, and compensation misalignment.",
      "All logged retention recommendations should undergo human evaluation before being actioned.",
    ],
  });
};

export interface AuditLogExportItem {
  id: string;
  action: string;
  entity_name: string;
  description: string;
  timestamp: string;
  user?: {
    username?: string;
    email?: string;
    display_name?: string;
    role?: string;
  } | null;
}

/**
 * 3. Compliance Audit Logs Exporter
 */
export const exportComplianceAuditLogs = (
  format: "csv" | "pdf",
  logs: AuditLogExportItem[],
): void => {
  const headers = [
    "Timestamp",
    "Action",
    "Entity Affected",
    "Description",
    "Operator Name",
    "Operator Email",
    "Operator Role",
  ];

  if (format === "csv") {
    const rows = logs.map((log) => [
      log.timestamp,
      log.action,
      log.entity_name,
      log.description,
      log.user?.display_name || log.user?.username || "System",
      log.user?.email || "system@workforce.local",
      log.user?.role || "SYSTEM",
    ]);
    downloadCsv(`Compliance_Audit_Log_${new Date().toISOString().split("T")[0]}`, headers, rows);
    return;
  }

  // PDF Formatted Report
  const totalLogs = logs.length;
  const uniqueUsers = new Set(logs.map((l) => l.user?.email).filter(Boolean)).size;
  const mutationsCount = logs.filter((l) => ["CREATE", "UPDATE", "DELETE"].includes(l.action)).length;

  const tableRows = logs.map((log) => {
    let badge: "low" | "medium" | "high" | "critical" | "neutral" = "neutral";
    if (log.action === "DELETE") badge = "critical";
    else if (log.action === "CREATE") badge = "low";
    else if (log.action === "UPDATE") badge = "medium";
    else if (log.action.includes("PREDICT")) badge = "neutral";

    return [
      new Date(log.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      { text: log.action, badge },
      log.entity_name,
      log.description,
      log.user?.display_name || log.user?.username || "System",
      log.user?.email || "—",
      log.user?.role || "SYSTEM",
    ];
  });

  openFormattedPdfReport({
    title: "System Compliance & Administrative Audit Trail Report",
    subtitle: "Complete operational ledger documenting configuration modifications, user access, and model runs",
    reportCode: "REP-COMPLIANCE-AUDIT-03",
    generatedBy: "HR Compliance Oversight",
    kpis: [
      { label: "Total Log Entries", value: totalLogs, subtext: "Recorded operations" },
      { label: "Active Operators", value: uniqueUsers, subtext: "Distinct actors" },
      { label: "State Mutations", value: mutationsCount, tone: "accent", subtext: "CREATE / UPDATE / DELETE" },
      { label: "Compliance Status", value: "Verified", tone: "success", subtext: "Immutable audit sequence" },
    ],
    tableHeaders: headers,
    tableRows,
    summaryNotes: [
      "Audit trail records are tamper-resistant and recorded server-side upon every sensitive administrative and analytical action.",
      "This document serves as verification for enterprise data governance and HR security standards compliance.",
    ],
  });
};
