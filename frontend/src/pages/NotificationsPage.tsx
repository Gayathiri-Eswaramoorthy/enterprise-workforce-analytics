import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Notification } from "../types";
import { Bell, CheckCheck, CheckCircle2, ExternalLink } from "lucide-react";

/**
 * Maps a notification to a specific, relevant route based on user role and content.
 * Falls back safely to role home page if no reliable destination matches.
 */
const getNotificationDestination = (
  notification: Notification,
  role?: string
): { path: string; label: string } => {
  const text = `${notification.title} ${notification.message}`.toLowerCase();

  if (role === "EMPLOYEE") {
    // Career Discussion / Employee Requests
    if (
      text.includes("request") ||
      text.includes("discussion") ||
      text.includes("career") ||
      text.includes("one on one")
    ) {
      return { path: "/my-requests", label: "View Requests" };
    }
    // Training Progress / Quiz Scores / Certificates
    if (
      text.includes("progress") ||
      text.includes("score") ||
      text.includes("passed") ||
      text.includes("certificate") ||
      text.includes("attempt")
    ) {
      return { path: "/my-progress", label: "View Progress" };
    }
    // Course / Learning / Lesson
    if (
      text.includes("course") ||
      text.includes("lesson") ||
      text.includes("learning") ||
      text.includes("training") ||
      text.includes("quiz")
    ) {
      return { path: "/my-learning", label: "View Learning" };
    }
    // Skills
    if (text.includes("skill") || text.includes("gap") || text.includes("proficiency")) {
      return { path: "/my-skills", label: "View Skills" };
    }
    // Fallback for employee
    return { path: "/", label: "View Dashboard" };
  }

  if (role === "HR_MANAGER") {
    // Discussion / Employee Requests
    if (
      text.includes("request") ||
      text.includes("discussion") ||
      text.includes("one on one")
    ) {
      return { path: "/recommendations", label: "View Requests" };
    }
    // Attrition Risk alerts
    if (
      text.includes("risk alert") ||
      text.includes("risk") ||
      text.includes("flight risk") ||
      text.includes("attrition") ||
      text.includes("prediction")
    ) {
      return { path: "/predictions", label: "View Predictions" };
    }
    // Recommendations / Interventions
    if (
      text.includes("recommendation") ||
      text.includes("intervention") ||
      text.includes("retention")
    ) {
      return { path: "/recommendations", label: "View Recommendations" };
    }
    // Training / Learning Analytics
    if (
      text.includes("training") ||
      text.includes("course") ||
      text.includes("learning") ||
      text.includes("curriculum")
    ) {
      return { path: "/training", label: "View Training Analytics" };
    }
    // Skills
    if (text.includes("skill") || text.includes("gap") || text.includes("proficiency")) {
      return { path: "/skills", label: "View Skills" };
    }
    // Fallback for HR Manager
    return { path: "/", label: "View Workforce" };
  }

  if (role === "HR_ADMIN") {
    // Audit / Security / System alerts
    if (
      text.includes("audit") ||
      text.includes("security") ||
      text.includes("log") ||
      text.includes("system")
    ) {
      return { path: "/audit-logs", label: "View Audit Logs" };
    }
    // User accounts
    if (text.includes("user") || text.includes("account") || text.includes("password")) {
      return { path: "/users", label: "View Users" };
    }
    // Employee alerts / requests
    if (text.includes("employee") || text.includes("request") || text.includes("risk")) {
      return { path: "/employees", label: "View Employees" };
    }
    // Fallback for HR Admin
    return { path: "/", label: "View System Overview" };
  }

  // Generic fallback
  return { path: "/", label: "View" };
};

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      // Synchronize top-right notification bell badge immediately
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      // Synchronize top-right notification bell badge immediately
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (err) {
      console.error("Failed to mark all read", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-ink sm:text-lg">Notification Center</h1>
          <p className="text-xs text-ink-3">Stay updated with course alerts, risk events, and team activity.</p>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-link hover:underline underline-offset-4"
          >
            <CheckCheck className="h-4 w-4" /> Mark All as Read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border border-rule bg-panel p-12 text-center text-ink-3 text-sm shadow-card">
            <Bell className="h-8 w-8 mx-auto mb-2 text-ink-3/50" />
            No notifications available.
          </div>
        ) : (
          notifications.map((n) => {
            const dest = getNotificationDestination(n, user?.role);
            return (
              <div
                key={n.id}
                className={`p-4 sm:p-5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  n.is_read
                    ? "bg-sunken/60 border-rule opacity-80"
                    : "bg-panel border-rule-strong shadow-card"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 mt-0.5 ${
                      n.is_read ? "bg-sunken text-ink-3" : "bg-accent-soft text-link"
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-ink">{n.title}</h4>
                      {!n.is_read && (
                        <span className="rounded-full bg-accent px-1.5 py-0.2 text-[9px] font-semibold text-white">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-2 mt-1 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-ink-3 mt-1.5 block">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 flex-wrap items-center gap-2 self-start sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-rule w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => navigate(dest.path)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-panel px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-hover hover:border-rule-strong transition-colors"
                    aria-label={`${dest.label} for ${n.title}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-ink-3" />
                    <span>{dest.label}</span>
                  </button>

                  {!n.is_read ? (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-accent-ring bg-accent-soft px-3 py-1.5 text-xs font-semibold text-link hover:bg-accent/20 transition-colors"
                      aria-label={`Mark as read: ${n.title}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark as Read</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-ink-3">
                      <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Read</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

