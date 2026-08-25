import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import type { EmployeeListItem, Department, JobRole, RiskLevel } from "../types";
import { Search, Plus, ArrowRight } from "lucide-react";

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [page, setPage] = useState(1);

  // New Employee Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [newEmp, setNewEmp] = useState({
    employee_code: "",
    first_name: "",
    last_name: "",
    date_of_birth: "1994-01-01",
    gender: "MALE",
    phone_number: "+1-555-0100",
    official_email: "",
    department_id: "",
    job_role_id: "",
    date_of_joining: "2024-01-15",
    employment_status: "ACTIVE",
    employment_type: "FULL_TIME",
    work_mode: "HYBRID",
    work_location: "San Francisco, CA",
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 15 };
      if (search) params.search = search;
      if (selectedDept) params.department_id = selectedDept;

      const res = await api.get("/employees", { params });
      setEmployees(res.data.items);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [deptRes, rolesRes] = await Promise.all([
        api.get("/departments"),
        api.get("/job-roles"),
      ]);
      setDepartments(deptRes.data);
      setRoles(rolesRes.data);
      if (deptRes.data.length > 0) {
        setNewEmp((prev) => ({
          ...prev,
          department_id: deptRes.data[0].id,
        }));
      }
      if (rolesRes.data.length > 0) {
        setNewEmp((prev) => ({
          ...prev,
          job_role_id: rolesRes.data[0].id,
        }));
      }
    } catch (err) {
      console.error("Failed to load departments or roles", err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [page, search, selectedDept]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      await api.post("/employees", newEmp);
      setShowModal(false);
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create employee record");
    } finally {
      setModalLoading(false);
    }
  };

  const getRiskBadge = (risk?: RiskLevel) => {
    switch (risk) {
      case "CRITICAL":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Critical</span>;
      case "HIGH":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">High Risk</span>;
      case "MEDIUM":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Low Risk</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, email, code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-800 bg-[#0F1524] pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-800 bg-[#0F1524] px-3.5 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0F1524] overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-[#0B0F19]/60 text-xs uppercase font-semibold text-slate-400 tracking-wider">
            <tr>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Department & Role</th>
              <th className="px-6 py-4">Mode</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Attrition Risk</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                  <p className="mt-2 text-xs">Loading employee records...</p>
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  No employee profiles found matching criteria.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 font-bold text-slate-200 shadow-inner">
                        {emp.first_name[0]}
                        {emp.last_name[0]}
                      </div>
                      <div>
                        <Link
                          to={`/employees/${emp.id}`}
                          className="font-medium text-slate-100 hover:text-indigo-400 transition-colors"
                        >
                          {emp.full_name || `${emp.first_name} ${emp.last_name}`}
                        </Link>
                        <p className="text-xs text-slate-500">{emp.employee_code} • {emp.official_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-200 block">{emp.job_role_title || "Role"}</span>
                    <span className="text-xs text-slate-500">{emp.department_name || "Department"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">
                      {emp.work_mode}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400">
                      {emp.employment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getRiskBadge(emp.latest_risk_level)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/employees/${emp.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      View Profile <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0F1524] p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Add New Employee Profile</h3>
            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Employee Code</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-ENG-099"
                    value={newEmp.employee_code}
                    onChange={(e) => setNewEmp({ ...newEmp, employee_code: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    placeholder="john.doe@workforce.local"
                    value={newEmp.official_email}
                    onChange={(e) => setNewEmp({ ...newEmp, official_email: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="John"
                    value={newEmp.first_name}
                    onChange={(e) => setNewEmp({ ...newEmp, first_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Doe"
                    value={newEmp.last_name}
                    onChange={(e) => setNewEmp({ ...newEmp, last_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Department</label>
                  <select
                    value={newEmp.department_id}
                    onChange={(e) => setNewEmp({ ...newEmp, department_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Job Role</label>
                  <select
                    value={newEmp.job_role_id}
                    onChange={(e) => setNewEmp({ ...newEmp, job_role_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Work Mode</label>
                  <select
                    value={newEmp.work_mode}
                    onChange={(e) => setNewEmp({ ...newEmp, work_mode: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="OFFICE">Office</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="REMOTE">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Date of Joining</label>
                  <input
                    type="date"
                    required
                    value={newEmp.date_of_joining}
                    onChange={(e) => setNewEmp({ ...newEmp, date_of_joining: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={newEmp.phone_number}
                    onChange={(e) => setNewEmp({ ...newEmp, phone_number: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-[#0B0F19] px-3.5 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {modalLoading ? "Saving..." : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
