import React, { useState, useEffect } from "react";
import api from "../services/api";
import type { Notification } from "../types";
import { Bell, CheckCheck, CheckCircle2 } from "lucide-react";

export const NotificationsPage: React.FC = () => {
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
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all read", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-100">Notification Center</h3>
        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            <CheckCheck className="h-4 w-4" /> Mark All as Read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#0F1524] p-12 text-center text-slate-500 text-sm">
            <Bell className="h-8 w-8 mx-auto mb-2 text-slate-600" />
            No notifications available.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                n.is_read
                  ? "bg-[#0F1524]/60 border-slate-850 opacity-75"
                  : "bg-[#0F1524] border-indigo-500/30 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0 mt-0.5">
                  <Bell className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">{n.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{n.message}</p>
                  <span className="text-[10px] text-slate-500 mt-2 block">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {!n.is_read && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                  title="Mark as read"
                >
                  <CheckCircle2 className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
