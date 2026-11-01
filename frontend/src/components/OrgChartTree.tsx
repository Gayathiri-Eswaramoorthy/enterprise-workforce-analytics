import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { Department, EmployeeListItem, RiskLevel } from "../types";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { RiskBadge } from "./RiskBadge";

interface OrgChartTreeProps {
  employees: EmployeeListItem[];
  departments: Department[];
}

interface TreeNode {
  employee: EmployeeListItem;
  children: TreeNode[];
  directReportsCount: number;
  branchTotalHeadcount: number;
  branchAtRiskCount: number;
  branchAvgRiskScore: number | null;
  clusterSeverity: "CRITICAL" | "HIGH" | "ELEVATED" | "STABLE";
}

export const OrgChartTree: React.FC<OrgChartTreeProps> = ({ employees, departments }) => {
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all");
  const [riskClusterFilter, setRiskClusterFilter] = useState<"all" | "at_risk_only">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    employees.forEach((e) => {
      if (e.manager_id) initial.add(e.manager_id);
    });
    return initial;
  });

  useEffect(() => {
    if (employees.length > 0) {
      setCollapsedNodes((prev) => {
        if (prev.size > 0) return prev;
        const managers = new Set<string>();
        employees.forEach((e) => {
          if (e.manager_id) managers.add(e.manager_id);
        });
        return managers;
      });
    }
  }, [employees]);

  // Filter employees by department if one is selected
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => !e.is_deleted);
  }, [employees]);

  // Build the hierarchical tree structure and compute subtree branch metrics
  const treeData = useMemo(() => {
    const empMap = new Map<string, EmployeeListItem>();
    activeEmployees.forEach((e) => empMap.set(e.id, e));

    const childrenMap = new Map<string, EmployeeListItem[]>();
    activeEmployees.forEach((e) => {
      const parentId = e.manager_id;
      if (parentId) {
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
        childrenMap.get(parentId)!.push(e);
      }
    });

    const buildNode = (emp: EmployeeListItem): TreeNode => {
      const childEmps = childrenMap.get(emp.id) ?? [];
      const children = childEmps.map(buildNode);

      let totalHeadcount = 1;
      let atRiskCount = (emp.latest_risk_level === "HIGH" || emp.latest_risk_level === "CRITICAL") ? 1 : 0;
      let scoreSum = emp.latest_risk_score != null ? Number(emp.latest_risk_score) : 0;
      let scoredCount = emp.latest_risk_score != null ? 1 : 0;

      children.forEach((c) => {
        totalHeadcount += c.branchTotalHeadcount;
        atRiskCount += c.branchAtRiskCount;
        if (c.branchAvgRiskScore != null) {
          scoreSum += c.branchAvgRiskScore * c.branchTotalHeadcount;
          scoredCount += c.branchTotalHeadcount;
        }
      });

      const riskRate = atRiskCount / totalHeadcount;
      let severity: "CRITICAL" | "HIGH" | "ELEVATED" | "STABLE" = "STABLE";

      if (atRiskCount >= 3 || (totalHeadcount >= 3 && riskRate >= 0.35)) {
        severity = "CRITICAL";
      } else if (atRiskCount >= 2 || (totalHeadcount >= 2 && riskRate >= 0.25)) {
        severity = "HIGH";
      } else if (atRiskCount >= 1) {
        severity = "ELEVATED";
      }

      return {
        employee: emp,
        children,
        directReportsCount: childEmps.length,
        branchTotalHeadcount: totalHeadcount,
        branchAtRiskCount: atRiskCount,
        branchAvgRiskScore: scoredCount > 0 ? scoreSum / scoredCount : null,
        clusterSeverity: severity,
      };
    };

    // Root nodes: managers with no manager_id or manager is outside active set
    const rootEmps = activeEmployees.filter(
      (e) => !e.manager_id || !empMap.has(e.manager_id),
    );

    return rootEmps.map(buildNode);
  }, [activeEmployees]);

  // Filter root trees by Department and Risk Cluster selection
  const filteredTrees = useMemo(() => {
    return treeData.filter((root) => {
      if (selectedDeptId !== "all" && root.employee.department_id !== selectedDeptId) {
        // Also check if any descendant belongs to the department
        const hasDeptDescendant = (node: TreeNode): boolean => {
          if (node.employee.department_id === selectedDeptId) return true;
          return node.children.some(hasDeptDescendant);
        };
        if (!hasDeptDescendant(root)) return false;
      }

      if (riskClusterFilter === "at_risk_only" && root.branchAtRiskCount === 0) {
        return false;
      }

      return true;
    });
  }, [treeData, selectedDeptId, riskClusterFilter]);

  // Aggregate KPI stats for the top summary
  const summary = useMemo(() => {
    let totalManagers = 0;
    let criticalClusters = 0;
    let highRiskBranches = 0;

    const countNodes = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        if (n.directReportsCount > 0) {
          totalManagers++;
          if (n.clusterSeverity === "CRITICAL") criticalClusters++;
          else if (n.clusterSeverity === "HIGH" || n.clusterSeverity === "ELEVATED") highRiskBranches++;
        }
        countNodes(n.children);
      });
    };
    countNodes(treeData);

    return { totalManagers, criticalClusters, highRiskBranches };
  }, [treeData]);

  const toggleNode = (empId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const expandAll = () => setCollapsedNodes(new Set());

  const collapseAll = () => {
    const allManagerIds = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        if (n.directReportsCount > 0) allManagerIds.add(n.employee.id);
        collect(n.children);
      });
    };
    collect(treeData);
    setCollapsedNodes(allManagerIds);
  };

  // Node Component rendered recursively
  const renderNode = (node: TreeNode, depth: number = 0) => {
    const { employee, children, directReportsCount, branchTotalHeadcount, branchAtRiskCount, clusterSeverity } = node;
    const isCollapsed = collapsedNodes.has(employee.id);
    const hasChildren = directReportsCount > 0;
    const isMatchesSearch = searchQuery.trim() !== "" &&
      (employee.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       employee.job_role_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       employee.employee_code.toLowerCase().includes(searchQuery.toLowerCase()));

    const isRiskLevelHighOrCritical = employee.latest_risk_level === "HIGH" || employee.latest_risk_level === "CRITICAL";

    // Cluster border styling
    let clusterBorder = "border-rule";
    let clusterBadgeBg = "bg-slate-100 text-slate-700";
    if (clusterSeverity === "CRITICAL") {
      clusterBorder = "border-[#d0216e] ring-1 ring-[#d0216e]/20";
      clusterBadgeBg = "bg-rose-50 text-rose-700 border border-rose-200";
    } else if (clusterSeverity === "HIGH") {
      clusterBorder = "border-[#f25a2a] ring-1 ring-[#f25a2a]/20";
      clusterBadgeBg = "bg-orange-50 text-orange-700 border border-orange-200";
    } else if (clusterSeverity === "ELEVATED") {
      clusterBorder = "border-[#eda312]";
      clusterBadgeBg = "bg-amber-50 text-amber-800 border border-amber-200";
    }

    const initials = (employee.first_name?.[0] || "") + (employee.last_name?.[0] || "");

    return (
      <div key={employee.id} className="relative flex flex-col items-start">
        {/* Card Component */}
        <div
          className={`group relative flex w-[320px] flex-col rounded-xl border bg-panel p-3.5 transition-all duration-150 ${clusterBorder} ${
            isMatchesSearch ? "ring-2 ring-accent" : "hover:border-rule-strong hover:shadow-card"
          }`}
          style={{
            boxShadow: "0 1px 3px rgba(12, 26, 51, 0.04)",
          }}
        >
          {/* Top Branch Risk Banner for Managers */}
          {hasChildren && (
            <div className={`mb-2.5 flex items-center justify-between rounded-lg px-2.5 py-1 text-[11px] font-semibold ${clusterBadgeBg}`}>
              <div className="flex items-center gap-1.5">
                {branchAtRiskCount > 0 ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Users className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                )}
                <span>
                  {branchAtRiskCount > 0 ? (
                    <>
                      <strong>{branchAtRiskCount} at-risk</strong> in branch ({Math.round((branchAtRiskCount / branchTotalHeadcount) * 100)}%)
                    </>
                  ) : (
                    <span>Branch Risk: Stable (0 at-risk)</span>
                  )}
                </span>
              </div>
              <span className="text-[10px] opacity-80">{branchTotalHeadcount} team</span>
            </div>
          )}

          {/* Employee Header */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-semibold text-[13px]"
                style={{
                  backgroundColor: isRiskLevelHighOrCritical ? "rgba(242, 90, 42, 0.12)" : "var(--accent-soft)",
                  color: isRiskLevelHighOrCritical ? "#c2410c" : "var(--accent)",
                }}
              >
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/employees/${employee.id}`}
                    className="font-semibold text-[13.5px] text-ink hover:text-link transition-colors leading-tight"
                  >
                    {employee.full_name || `${employee.first_name} ${employee.last_name}`}
                  </Link>
                </div>
                <div className="text-[11.5px] text-ink-3 leading-tight mt-0.5 truncate max-w-[170px]" title={employee.job_role_title}>
                  {employee.job_role_title || "Team Member"}
                </div>
              </div>
            </div>

            <Link
              to={`/employees/${employee.id}`}
              className="text-ink-3 hover:text-link p-1 rounded transition-colors"
              title="View full employee profile"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Department & Employee Code Meta */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-3 border-t border-rule-soft pt-2">
            <span className="font-mono text-ink-2 font-medium">{employee.employee_code}</span>
            <span className="rounded bg-sunken px-1.5 py-0.5 font-medium text-ink-2">
              {employee.department_name || "Department"}
            </span>
          </div>

          {/* Individual Risk Rating */}
          <div className="mt-2 flex items-center justify-between border-t border-rule-soft pt-2">
            <span className="text-[11px] text-ink-3">Attrition Risk:</span>
            {employee.latest_risk_level ? (
              <RiskBadge level={employee.latest_risk_level as RiskLevel} score={employee.latest_risk_score ?? undefined} />
            ) : (
              <span className="text-[11px] text-ink-3">Not scored</span>
            )}
          </div>

          {/* Collapse/Expand action bar if manager has reports */}
          {hasChildren && (
            <button
              onClick={() => toggleNode(employee.id)}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rule bg-sunken/60 py-1 text-[11.5px] font-medium text-ink-2 hover:bg-sunken hover:text-ink transition-colors"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>
                {isCollapsed
                  ? `Show ${directReportsCount} Direct Report${directReportsCount > 1 ? "s" : ""}`
                  : `Hide Direct Reports (${directReportsCount})`}
              </span>
            </button>
          )}
        </div>

        {/* Child Subtree with visual connecting lines */}
        {hasChildren && !isCollapsed && (
          <div className="relative ml-6 mt-3 pl-6 border-l-2 border-rule-strong space-y-3">
            {children.map((childNode) => (
              <div key={childNode.employee.id} className="relative">
                {/* Horizontal connector line */}
                <div className="absolute -left-6 top-6 h-0.5 w-6 bg-rule-strong" />
                {renderNode(childNode, depth + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Risk Cluster KPI Banner */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="card-raised flex items-center justify-between p-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">Managerial Branches</div>
            <div className="text-[24px] font-bold text-ink mt-0.5">{summary.totalManagers}</div>
            <div className="text-[11px] text-ink-3">Teams with direct reporting lines</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-link">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="card-raised flex items-center justify-between p-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-rose-600">Critical Risk Clusters</div>
            <div className="text-[24px] font-bold text-rose-700 mt-0.5">{summary.criticalClusters}</div>
            <div className="text-[11px] text-ink-3">Branches with ≥3 at-risk or ≥35% risk density</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        <div className="card-raised flex items-center justify-between p-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-amber-700">Elevated / High Branches</div>
            <div className="text-[24px] font-bold text-amber-800 mt-0.5">{summary.highRiskBranches}</div>
            <div className="text-[11px] text-ink-3">Branches requiring retention check-ins</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="card-raised flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative min-w-[200px] flex-1 max-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search manager or report..."
              className="field pl-8 py-1.5 text-[13px]"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="field w-auto py-1.5 text-[13px]"
          >
            <option value="all">All Departments ({departments.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.department_code})
              </option>
            ))}
          </select>

          {/* Risk Cluster Filter Tabs */}
          <div className="well flex p-0.5" role="group" aria-label="Risk cluster filter">
            <button
              onClick={() => setRiskClusterFilter("all")}
              className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                riskClusterFilter === "all" ? "bg-panel text-ink shadow-sm font-semibold" : "text-ink-2 hover:text-ink"
              }`}
            >
              All Trees
            </button>
            <button
              onClick={() => setRiskClusterFilter("at_risk_only")}
              className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                riskClusterFilter === "at_risk_only"
                  ? "bg-panel text-rose-700 shadow-sm font-semibold"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              ⚠️ Clusters with At-Risk
            </button>
          </div>
        </div>

        {/* Tree Expand / Collapse controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="rounded-lg border border-rule bg-panel px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-sunken transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="rounded-lg border border-rule bg-panel px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-sunken transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Visual Trees Container */}
      <div className="card-raised p-6 overflow-x-auto min-h-[480px]">
        {filteredTrees.length === 0 ? (
          <div className="py-16 text-center text-ink-3">
            <Users className="mx-auto h-8 w-8 text-ink-3/40 mb-2" />
            <div className="text-[14px] font-semibold text-ink">No reporting hierarchies found</div>
            <div className="text-[12.5px] text-ink-3 mt-1">
              Try adjusting your department or risk cluster filters.
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-10">
            {filteredTrees.map((rootTree) => (
              <div key={rootTree.employee.id} className="min-w-[340px]">
                {/* Branch root title */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    {rootTree.employee.department_name || "Branch"} Lineage
                  </span>
                </div>
                {renderNode(rootTree, 0)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
