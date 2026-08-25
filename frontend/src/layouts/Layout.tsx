import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import {
  LayoutDashboard,
  Users,
  Building2,
  Cpu,
  Brain,
  Lightbulb,
  GraduationCap,
  History,
  Bell,
  LogOut,
} from "lucide-react";

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setUnreadCount(res.data.unread_count);
    } catch {
      // Quiet fail if not authenticated
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["HR_ADMIN", "HR_MANAGER", "EMPLOYEE"] },
    { to: "/employees", label: "Employees", icon: Users, roles: ["HR_ADMIN", "HR_MANAGER"] },
    { to: "/departments", label: "Departments", icon: Building2, roles: ["HR_ADMIN", "HR_MANAGER", "EMPLOYEE"] },
    { to: "/skills", label: "Skills Catalog", icon: Cpu, roles: ["HR_ADMIN", "HR_MANAGER", "EMPLOYEE"] },
    { to: "/predictions", label: "ML Risk Predictions", icon: Brain, roles: ["HR_ADMIN", "HR_MANAGER"] },
    { to: "/recommendations", label: "Recommendations", icon: Lightbulb, roles: ["HR_ADMIN", "HR_MANAGER"] },
    { to: "/training", label: "Training Hub", icon: GraduationCap, roles: ["HR_ADMIN", "HR_MANAGER", "EMPLOYEE"] },
    { to: "/audit-logs", label: "System Audit Logs", icon: History, roles: ["HR_ADMIN"] },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F19] text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-[#0F1524] flex flex-col">
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 text-white font-black text-lg shadow-md shadow-indigo-500/25">
            W
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              WorkforceAI
            </h1>
            <p className="text-[10px] font-semibold tracking-wider text-indigo-400 uppercase">
              Predictive Platform
            </p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          {navItems.map((item) => {
            const isAllowed = user && item.roles.includes(user.role);
            if (!isAllowed) return null;

            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/15"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800 bg-[#0B0F19]/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center font-bold text-white shadow-inner">
              {user?.display_name?.charAt(0) || user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-slate-200 truncate">
                {user?.display_name || user?.username}
              </h4>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/10 mt-1">
                {user?.role.replace("_", " ")}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-[#0F1524] flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-200">
              {navItems.find((item) => item.to === location.pathname)?.label || "Workforce Management"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Notifications Button */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-200"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#0F1524]">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Dynamic Route Outlet */}
        <main className="flex-1 overflow-y-auto bg-[#0B0F19] p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
