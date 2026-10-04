import React, { useState, useEffect, useCallback } from "react";
import api, { getErrorMessage } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { EnrollmentStatus, TrainingCourse, TrainingEnrollment } from "../types";
import { GraduationCap, Clock, BookOpen, Users, Check } from "lucide-react";
import { EnrollmentStatusBadge } from "../components/EnrollmentStatusBadge";

export const TrainingPage: React.FC = () => {
  const { user } = useAuth();
  const isEmployee = user?.role === "EMPLOYEE";
  const ownEmployeeId = user?.employee_id ?? null;

  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [tab, setTab] = useState<"courses" | "enrollments">("courses");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [cRes, eRes] = await Promise.all([
        api.get("/training/courses", { params: { active_only: true } }),
        // Employees without a linked profile have no enrollments to list
        isEmployee && !ownEmployeeId
          ? Promise.resolve({ data: { items: [] } })
          : api.get("/training/enrollments", { params: { page_size: 100 } }),
      ]);
      setCourses(cRes.data);
      setEnrollments(eRes.data.items);
    } catch (err) {
      console.error("Failed to load training data", err);
    }
  }, [isEmployee, ownEmployeeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Employee view: the enrollment (if any) the user holds for each course
  const myEnrollmentByCourse = new Map(
    enrollments.filter((e) => e.employee_id === ownEmployeeId).map((e) => [e.training_course_id, e])
  );

  const handleEnroll = async (courseId: string) => {
    if (!ownEmployeeId) return;
    setBusyId(courseId);
    try {
      await api.post("/training/enrollments", { employee_id: ownEmployeeId, training_course_id: courseId });
      await fetchData();
    } catch (err) {
      alert(getErrorMessage(err, "Enrollment failed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleSetStatus = async (enrollmentId: string, status: EnrollmentStatus) => {
    setBusyId(enrollmentId);
    try {
      await api.put(`/training/enrollments/${enrollmentId}`, { enrollment_status: status });
      await fetchData();
    } catch (err) {
      alert(getErrorMessage(err, "Could not update enrollment"));
    } finally {
      setBusyId(null);
    }
  };

  const activeEnrollments = enrollments.filter((e) => e.enrollment_status !== "DROPPED");

  return (
    <div className="space-y-6">
      {/* Switcher Tabs */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        <button
          onClick={() => setTab("courses")}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            tab === "courses"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Course Catalog ({courses.length})
        </button>
        <button
          onClick={() => setTab("enrollments")}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            tab === "enrollments"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="h-4 w-4" /> {isEmployee ? "My Enrollments" : "Enrollments"} ({activeEnrollments.length})
        </button>
      </div>

      {tab === "courses" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {courses.map((c) => {
            const mine = myEnrollmentByCourse.get(c.id);
            const enrolled = mine && mine.enrollment_status !== "DROPPED";
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between gap-4">
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
                  {c.training_skills && c.training_skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.training_skills.map((ts) => (
                        <span key={ts.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          {ts.skill?.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-600" /> {Number(c.duration_hours)} hours
                    </span>
                    <span className="text-slate-500">{c.provider}</span>
                  </div>
                  {isEmployee && ownEmployeeId && (
                    enrolled ? (
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <Check className="h-3.5 w-3.5" /> Enrolled
                        </span>
                        <EnrollmentStatusBadge status={mine.enrollment_status} />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEnroll(c.id)}
                        disabled={busyId === c.id}
                        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {busyId === c.id ? "Enrolling..." : "Enroll"}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "enrollments" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                <tr>
                  {!isEmployee && <th className="px-6 py-4">Employee</th>}
                  <th className="px-6 py-4">Course</th>
                  <th className="px-6 py-4">Enrollment Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">{isEmployee ? "Actions" : "Score"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                      No enrollments yet{isEmployee ? " - enroll in a course from the catalog." : "."}
                    </td>
                  </tr>
                )}
                {enrollments.map((en) => (
                  <tr key={en.id} className="hover:bg-slate-50/50 transition-colors">
                    {!isEmployee && (
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800 block">{en.employee_name || "—"}</span>
                        <span className="text-xs text-slate-500">{en.employee_code}</span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-slate-700">{en.course?.title || "—"}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(en.enrollment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <EnrollmentStatusBadge status={en.enrollment_status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isEmployee ? (
                        <div className="flex justify-end gap-2">
                          {en.enrollment_status === "ENROLLED" && (
                            <button
                              onClick={() => handleSetStatus(en.id, "IN_PROGRESS")}
                              disabled={busyId === en.id}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              Start
                            </button>
                          )}
                          {(en.enrollment_status === "ENROLLED" || en.enrollment_status === "IN_PROGRESS") && (
                            <button
                              onClick={() => handleSetStatus(en.id, "DROPPED")}
                              disabled={busyId === en.id}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Drop
                            </button>
                          )}
                          {en.enrollment_status === "COMPLETED" && (
                            <span className="text-xs font-bold text-emerald-600">
                              {en.completion_score != null ? `${Number(en.completion_score)}%` : "Done"}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-bold text-emerald-600">
                          {en.completion_score != null ? `${Number(en.completion_score)}%` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
