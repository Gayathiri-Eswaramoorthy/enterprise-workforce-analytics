import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Notification } from "../types";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  GraduationCap,
  Users,
  Layers,
  Filter,
} from "lucide-react";

export type CategoryKey = "ALL" | "CRITICAL" | "HIGH_RISK" | "TRAINING" | "ACTIVITY";

interface CategoryConfig {
  label: string;
  badgeClass: string;
  iconBg: string;
  borderGlow: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORY_CONFIG: Record<Exclude<CategoryKey, "ALL">, CategoryConfig> = {
  CRITICAL: {
    label: "Critical Risk",
    badgeClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60",
    iconBg: "bg-red-100/90 text-red-600 dark:bg-red-950 dark:text-red-400",
    borderGlow: "hover:border-red-300 dark:hover:border-red-800",
    icon: ShieldAlert,
  },
  HIGH_RISK: {
    label: "High Flight Risk",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60",
    iconBg: "bg-amber-100/90 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    borderGlow: "hover:border-amber-300 dark:hover:border-amber-800",
    icon: AlertTriangle,
  },
  TRAINING: {
    label: "Learning & Skills",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60",
    iconBg: "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    borderGlow: "hover:border-emerald-300 dark:hover:border-emerald-800",
    icon: GraduationCap,
  },
  ACTIVITY: {
    label: "Team & System",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/60",
    iconBg: "bg-indigo-100/90 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
    borderGlow: "hover:border-indigo-300 dark:hover:border-indigo-800",
    icon: Users,
  },
};

const classifyNotification = (n: Notification): Exclude<CategoryKey, "ALL"> => {
  const text = `${n.title} ${n.message}`.toLowerCase();
  if (text.includes("critical")) return "CRITICAL";
  if (
    text.includes("high risk") ||
    text.includes("flight risk") ||
    (text.includes("high") && text.includes("risk"))
  ) {
    return "HIGH_RISK";
  }
  if (
    text.includes("course") ||
    text.includes("lesson") ||
    text.includes("training") ||
    text.includes("learning") ||
    text.includes("quiz") ||
    text.includes("progress") ||
    text.includes("certificate") ||
    text.includes("skill")
  ) {
    return "TRAINING";
  }
  return "ACTIVITY";
};

/**
 * Maps a notification to a specific, relevant route based on user role and content.
 */
const getNotificationDestination = (
  notification: Notification,
  role?: string
): { path: string; label: string } => {
  const text = `${notification.title} ${notification.message}`.toLowerCase();

  if (role === "EMPLOYEE") {
    if (
      text.includes("request") ||
      text.includes("discussion") ||
      text.includes("career") ||
      text.includes("one on one")
    ) {
      return { path: "/my-requests", label: "View Requests" };
    }
    if (
      text.includes("progress") ||
      text.includes("score") ||
      text.includes("passed") ||
      text.includes("certificate") ||
      text.includes("attempt")
    ) {
      return { path: "/my-progress", label: "View Progress" };
    }
    if (
      text.includes("course") ||
      text.includes("lesson") ||
      text.includes("learning") ||
      text.includes("training") ||
      text.includes("quiz")
    ) {
      return { path: "/my-learning", label: "View Learning" };
    }
    if (text.includes("skill") || text.includes("gap") || text.includes("proficiency")) {
      return { path: "/my-skills", label: "View Skills" };
    }
    return { path: "/", label: "View Dashboard" };
  }

  if (role === "HR_MANAGER") {
    if (
      text.includes("request") ||
      text.includes("discussion") ||
      text.includes("one on one")
    ) {
      return { path: "/recommendations", label: "View Requests" };
    }
    if (
      text.includes("risk alert") ||
      text.includes("risk") ||
      text.includes("flight risk") ||
      text.includes("attrition") ||
      text.includes("prediction")
    ) {
      return { path: "/predictions", label: "View Predictions" };
    }
    if (
      text.includes("recommendation") ||
      text.includes("intervention") ||
      text.includes("retention")
    ) {
      return { path: "/recommendations", label: "View Recommendations" };
    }
    if (
      text.includes("training") ||
      text.includes("course") ||
      text.includes("learning") ||
      text.includes("curriculum")
    ) {
      return { path: "/training", label: "View Training Analytics" };
    }
    if (text.includes("skill") || text.includes("gap") || text.includes("proficiency")) {
      return { path: "/skills", label: "View Skills" };
    }
    return { path: "/", label: "View Workforce" };
  }

  if (role === "HR_ADMIN") {
    if (
      text.includes("audit") ||
      text.includes("security") ||
      text.includes("log") ||
      text.includes("system")
    ) {
      return { path: "/audit-logs", label: "View Audit Logs" };
    }
    if (text.includes("user") || text.includes("account") || text.includes("password")) {
      return { path: "/users", label: "View Users" };
    }
    if (text.includes("employee") || text.includes("request") || text.includes("risk")) {
      return { path: "/employees", label: "View Employees" };
    }
    return { path: "/", label: "View System Overview" };
  }

  return { path: "/", label: "View" };
};

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);

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
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (err) {
      console.error("Failed to mark all read", err);
    }
  };

  // Compute categorized counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      ALL: 0,
      CRITICAL: 0,
      HIGH_RISK: 0,
      TRAINING: 0,
      ACTIVITY: 0,
    };
    for (const n of notifications) {
      if (unreadOnly && n.is_read) continue;
      counts.ALL++;
      const cat = classifyNotification(n);
      counts[cat]++;
    }
    return counts;
  }, [notifications, unreadOnly]);

  const totalUnread = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (unreadOnly && n.is_read) return false;
      if (activeCategory !== "ALL") {
        return classifyNotification(n) === activeCategory;
      }
      return true;
    });
  }, [notifications, activeCategory, unreadOnly]);

  // Grouped when "ALL" is selected
  const groupedSections = useMemo(() => {
    if (activeCategory !== "ALL") return null;

    const groups: {
      key: Exclude<CategoryKey, "ALL">;
      meta: CategoryConfig;
      items: Notification[];
    }[] = [
      {
        key: "CRITICAL",
        meta: CATEGORY_CONFIG.CRITICAL,
        items: filteredNotifications.filter((n) => classifyNotification(n) === "CRITICAL"),
      },
      {
        key: "HIGH_RISK",
        meta: CATEGORY_CONFIG.HIGH_RISK,
        items: filteredNotifications.filter((n) => classifyNotification(n) === "HIGH_RISK"),
      },
      {
        key: "TRAINING",
        meta: CATEGORY_CONFIG.TRAINING,
        items: filteredNotifications.filter((n) => classifyNotification(n) === "TRAINING"),
      },
      {
        key: "ACTIVITY",
        meta: CATEGORY_CONFIG.ACTIVITY,
        items: filteredNotifications.filter((n) => classifyNotification(n) === "ACTIVITY"),
      },
    ];

    return groups.filter((g) => g.items.length > 0);
  }, [filteredNotifications, activeCategory]);

  const renderNotificationCard = (n: Notification) => {
    const cat = classifyNotification(n);
    const cfg = CATEGORY_CONFIG[cat];
    const CategoryIcon = cfg.icon;
    const dest = getNotificationDestination(n, user?.role);

    return (
      <div
        key={n.id}
        className={`p-4 sm:p-5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          n.is_read
            ? "bg-sunken/50 border-rule opacity-85"
            : "bg-panel border-rule-strong shadow-card"
        } ${cfg.borderGlow}`}
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 mt-0.5 ${
              n.is_read ? "bg-sunken text-ink-3" : cfg.iconBg
            }`}
          >
            <CategoryIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-semibold tracking-wide uppercase ${cfg.badgeClass}`}
              >
                {cfg.label}
              </span>
              <h4 className="text-sm font-semibold text-ink">{n.title}</h4>
              {!n.is_read && (
                <span className="rounded-full bg-accent px-1.5 py-0.2 text-[9px] font-semibold text-white">
                  NEW
                </span>
              )}
            </div>
            <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">{n.message}</p>
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
  };

  const CATEGORY_TABS: { key: CategoryKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "ALL", label: "All Alerts", icon: Layers },
    { key: "CRITICAL", label: "Critical Risk", icon: ShieldAlert },
    { key: "HIGH_RISK", label: "High Risk", icon: AlertTriangle },
    { key: "TRAINING", label: "Learning & Skills", icon: GraduationCap },
    { key: "ACTIVITY", label: "Team & System", icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-ink sm:text-lg">Notification Center</h1>
          <p className="text-xs text-ink-3">
            Categorized risk alerts, skill diagnostics, and workforce activity.
          </p>
        </div>
        {totalUnread > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-link hover:underline underline-offset-4"
          >
            <CheckCheck className="h-4 w-4" /> Mark All as Read ({totalUnread})
          </button>
        )}
      </div>

      {/* Category Tabs & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_TABS.map((tab) => {
            const count = categoryCounts[tab.key];
            const isActive = activeCategory === tab.key;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveCategory(tab.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "border border-rule bg-panel text-ink-2 hover:bg-hover hover:border-rule-strong"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-ink-3"}`} />
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                    isActive ? "bg-white/20 text-white" : "bg-sunken text-ink-3"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Unread Only filter */}
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            unreadOnly
              ? "border-accent bg-accent-soft text-link font-semibold"
              : "border-rule bg-panel text-ink-3 hover:text-ink hover:bg-hover"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Unread only</span>
          {totalUnread > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.2 text-[10px] font-bold text-link">
              {totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Notification Lists */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="rounded-xl border border-rule bg-panel p-12 text-center text-ink-3 text-sm shadow-card">
            <Bell className="h-8 w-8 mx-auto mb-2 text-ink-3/50" />
            No notifications match this category filter.
          </div>
        ) : activeCategory === "ALL" && groupedSections ? (
          // Grouped Sections when "ALL" is active
          groupedSections.map((group) => {
            const GroupIcon = group.meta.icon;
            return (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center gap-2.5 px-1">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md ${group.meta.iconBg}`}>
                    <GroupIcon className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-ink-2">
                    {group.meta.label}
                  </h2>
                  <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-3 tabular-nums">
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {group.items.map((n) => renderNotificationCard(n))}
                </div>
              </div>
            );
          })
        ) : (
          // Single category list
          <div className="space-y-2.5">
            {filteredNotifications.map((n) => renderNotificationCard(n))}
          </div>
        )}
      </div>
    </div>
  );
};
