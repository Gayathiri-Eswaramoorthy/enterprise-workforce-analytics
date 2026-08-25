import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { TrainingCourse, TrainingEnrollment } from "../types";
import { GraduationCap, Clock, BookOpen, Users } from "lucide-react";

export const TrainingPage: React.FC = () => {
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [tab, setTab] = useState<"courses" | "enrollments">("courses");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cRes, eRes] = await Promise.all([
          api.get("/training/courses"),
          api.get("/training/enrollments"),
        ]);
        setCourses(cRes.data);
        setEnrollments(eRes.data.items);
      } catch (err) {
        console.error("Failed to load training data", err);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Switcher Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setTab("courses")}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "courses"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Course Catalog ({courses.length})
        </button>
        <button
          onClick={() => setTab("enrollments")}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "enrollments"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="h-4 w-4" /> Active Enrollments ({enrollments.length})
        </button>
      </div>

      {tab === "courses" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-800 bg-[#0F1524] p-6 shadow-sm flex flex-col justify-between h-64">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                    {c.difficulty_level}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100">{c.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.description || "Upskilling course."}</p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" /> {c.duration_hours} Hours
                </span>
                <span className="text-slate-500">{c.provider}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "enrollments" && (
        <div className="rounded-2xl border border-slate-800 bg-[#0F1524] overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-[#0B0F19]/60 text-xs uppercase font-semibold text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Enrollment Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {enrollments.map((en) => (
                <tr key={en.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {en.employee ? `${en.employee.first_name} ${en.employee.last_name}` : "Employee"}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {en.training_course?.title}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(en.enrollment_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {en.enrollment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-400">
                    {en.completion_score ? `${en.completion_score}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
