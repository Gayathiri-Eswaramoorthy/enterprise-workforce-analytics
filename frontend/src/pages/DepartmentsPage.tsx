import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Department } from "../types";
import { Building2, Users, Cpu } from "lucide-react";

export const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get("/departments");
        setDepartments(res.data);
      } catch (err) {
        console.error("Failed to load departments", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDepts();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {departments.map((dept) => (
        <div key={dept.id} className="rounded-2xl border border-slate-800 bg-[#0F1524] p-6 shadow-sm hover:border-slate-700/80 transition-all flex flex-col justify-between h-56">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <Building2 className="h-5.5 w-5.5" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                {dept.department_code}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100">{dept.name}</h3>
            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{dept.description || "No description provided."}</p>
          </div>

          <div className="flex items-center gap-6 border-t border-slate-850 pt-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-400" /> Managed Team
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-sky-400" /> Active Gaps
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
