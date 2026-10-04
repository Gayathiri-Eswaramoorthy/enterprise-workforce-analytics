import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import type { UserRole } from "../types";
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
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const ALL_ROLES: UserRole[] = ["HR_ADMIN", "HR_MANAGER", "EMPLOYEE"];
const HR_ROLES: UserRole[] = ["HR_ADMIN", "HR_MANAGER"];

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: HR_ROLES },
  { to: "/", label: "My Dashboard", icon: LayoutDashboard, roles: ["EMPLOYEE"] },
  { to: "/employees", label: "Employees", icon: Users, roles: HR_ROLES },
  { to: "/departments", label: "Departments", icon: Building2, roles: ALL_ROLES },
  { to: "/skills", label: "Skills Catalog", icon: Cpu, roles: ALL_ROLES },
  { to: "/predictions", label: "ML Risk Predictions", icon: Brain, roles: HR_ROLES },
  { to: "/recommendations", label: "Recommendations", icon: Lightbulb, roles: HR_ROLES },
  { to: "/training", label: "Training Hub", icon: GraduationCap, roles: ALL_ROLES },
  { to: "/audit-logs", label: "System Audit Logs", icon: History, roles: ["HR_ADMIN"] },
];

const ROLE_LABEL: Record<UserRole, string> = {
  HR_ADMIN: "HR Admin",
  HR_MANAGER: "HR Manager",
  EMPLOYEE: "Employee",
};

const getPageTitle = (pathname: string, items: NavItem[]): string => {
  const navMatch = items.find((item) => item.to === pathname);
  if (navMatch) return navMatch.label;
  if (pathname === "/notifications") return "Notifications";
  if (pathname.startsWith("/employees/")) return "Employee Profile";
  return "Workforce Management";
};

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await api.get("/notifications/unread-count");
        setUnreadCount(res.data.unread_count);
      } catch {
        // Quiet fail if not authenticated
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
    // Re-check after navigating (e.g. leaving the Notifications page after reading them)
  }, [location.pathname]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const navItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));
  const displayName = user?.display_name || user?.username || "";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] text-slate-800 font-sans">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: off-canvas drawer below lg, static column from lg up */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between gap-2.5 px-6 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-lg shadow-sm">
              W
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-800">WorkforceAI</h1>
              <p className="text-[10px] font-semibold tracking-wider text-indigo-600 uppercase">
                Predictive Platform
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.to ||
              (item.to === "/employees" && location.pathname.startsWith("/employees/"));

            return (
              <Link
                key={`${item.to}-${item.label}`}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-inner">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-slate-800 truncate" title={displayName}>
                {displayName}
              </h4>
              {user && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 mt-1">
                  {ROLE_LABEL[user.role]}
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex-shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-8 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-800 truncate">
              {getPageTitle(location.pathname, navItems)}
            </h2>
          </div>
          <Link
            to="/notifications"
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </header>

        {/* Dynamic Route Outlet */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
