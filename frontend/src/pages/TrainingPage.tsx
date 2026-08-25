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
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setTab("courses")}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "courses"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Course Catalog ({courses.length})
        </button>
        <button
          onClick={() => setTab("enrollments")}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "enrollments"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="h-4 w-4" /> Active Enrollments ({enrollments.length})
        </button>
      </div>

      {tab === "courses" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between h-64">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                    {c.difficulty_level}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{c.title}</h3>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{c.description || "Upskilling course."}</p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" /> {c.duration_hours} Hours
                </span>
                <span className="text-slate-500">{c.provider}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "enrollments" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Enrollment Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.map((en) => (
                <tr key={en.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {en.employee ? `${en.employee.first_name} ${en.employee.last_name}` : "Employee"}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {en.training_course?.title}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(en.enrollment_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {en.enrollment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">
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
