import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Skill } from "../types";
import { Cpu, Search, Tag } from "lucide-react";

export const SkillsPage: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await api.get("/skills");
        setSkills(res.data);
      } catch (err) {
        console.error("Failed to load skills catalog", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSkills();
  }, []);

  const filteredSkills = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.skill_code.toLowerCase().includes(search.toLowerCase()) ||
      s.skill_category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by skill name, category, code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-800 bg-[#0F1524] pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Skills Catalog */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-4 flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : filteredSkills.length === 0 ? (
          <p className="col-span-4 text-center text-sm text-slate-500 py-12">
            No matching skills found in catalog.
          </p>
        ) : (
          filteredSkills.map((sk) => (
            <div key={sk.id} className="rounded-2xl border border-slate-800 bg-[#0F1524] p-5 shadow-sm flex flex-col justify-between h-40">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700/60 uppercase">
                    {sk.skill_code}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-200">{sk.name}</h4>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                <Tag className="h-3.5 w-3.5 text-indigo-400" />
                {sk.skill_category}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
