import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import type { UserRole } from "../types";
import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ROLE_NAV_GROUPS: Record<UserRole, NavGroup[]> = {
  HR_ADMIN: [
    {
      label: "",
      items: [
        { to: "/", label: "System Overview", icon: LayoutDashboard },
        { to: "/employees", label: "Employee Records", icon: Users },
        { to: "/departments", label: "Departments", icon: Building2 },
        { to: "/users", label: "Users & Roles", icon: ShieldCheck },
        { to: "/audit-logs", label: "Audit Log", icon: ScrollText },
      ],
    },
  ],
  HR_MANAGER: [
    {
      label: "Workforce & Retention",
      items: [
        { to: "/", label: "Workforce Overview", icon: LayoutDashboard },
        { to: "/predictions", label: "Attrition Risk", icon: Activity },
        { to: "/recommendations", label: "Retention Actions & Follow-up", icon: ListChecks },
      ],
    },
    {
      label: "People & Talent",
      items: [
        { to: "/employees", label: "Employee Records", icon: Users },
        { to: "/departments", label: "Departments", icon: Building2 },
        { to: "/skills", label: "Skills & Skill Gaps", icon: Layers },
        { to: "/training", label: "Training & Learning Analytics", icon: GraduationCap },
        { to: "/audit-logs", label: "Compliance & Audit Log", icon: ScrollText },
      ],
    },
  ],
  EMPLOYEE: [
    {
      label: "Employee Self-Service",
      items: [
        { to: "/", label: "My Dashboard", icon: LayoutDashboard },
        { to: "/my-learning", label: "My Learning", icon: BookOpen },
        { to: "/my-skills", label: "My Skills", icon: Layers },
        { to: "/my-progress", label: "My Training Progress", icon: GraduationCap },
        { to: "/my-requests", label: "Career Discussion Requests", icon: MessageSquare },
        { to: "/notifications", label: "My Notifications", icon: Bell },
      ],
    },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  HR_ADMIN: "HR Admin",
  HR_MANAGER: "HR Manager",
  EMPLOYEE: "Employee",
};

const getPageTitle = (pathname: string, items: NavItem[], role?: UserRole): string => {
  const navMatch = items.find((item) => item.to === pathname);
  if (navMatch) return navMatch.label;
  if (pathname === "/") {
    if (role === "HR_ADMIN") return "System Overview";
    if (role === "HR_MANAGER") return "Workforce Overview";
    return "My Dashboard";
  }
  if (pathname === "/notifications") return "Notifications";
  if (pathname.startsWith("/employees/")) return "Employee Profile";
  return "Workforce Analytics";
};

const isItemActive = (item: NavItem, pathname: string) =>
  pathname === item.to || (item.to === "/employees" && pathname.startsWith("/employees/"));

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The raised puck glides between nav items instead of each item switching on and off
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [puck, setPuck] = useState<{ top: number; height: number } | null>(null);
  const [puckReady, setPuckReady] = useState(false);

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

    const handleNotificationsUpdated = () => {
      fetchUnreadCount();
    };
    window.addEventListener("notifications-updated", handleNotificationsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications-updated", handleNotificationsUpdated);
    };
    // Re-check after navigating (e.g. leaving the Notifications page after reading them)
  }, [location.pathname]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const groups = user ? ROLE_NAV_GROUPS[user.role] || [] : [];
  const navItems = groups.flatMap((group) => group.items);
  const activeItem = navItems.find((item) => isItemActive(item, location.pathname));
  const activeKey = activeItem ? `${activeItem.to}-${activeItem.label}` : null;

  useLayoutEffect(() => {
    const measure = () => {
      const el = activeKey ? itemRefs.current.get(activeKey) : undefined;
      setPuck(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    };
    measure();
    // Web fonts can change item heights after first paint
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeKey]);

  // Enable the glide only after the first placement, so the puck never flies in from the top
  useEffect(() => {
    if (puck && !puckReady) {
      const id = requestAnimationFrame(() => setPuckReady(true));
      return () => cancelAnimationFrame(id);
    }
  }, [puck, puckReady]);

  const displayName = user?.display_name || user?.username || "";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-ground text-ink">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[rgb(11_31_68/0.5)] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: off-canvas drawer below lg, static rail from lg up */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-shrink-0 flex-col bg-shell text-shell-ink transition-transform duration-300 ease-out-expo lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Link to="/" className="flex items-center gap-3 rounded-md group">
            <img
              src="/logo-sidebar.png"
              alt="WorkforceAI"
              className="h-8 w-auto max-w-[200px] object-contain transition-transform duration-200 group-hover:scale-[1.03]"
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-shell-muted hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-4 pb-6 pt-4">
          {puck && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-4 right-4 top-0 rounded-lg bg-white/[0.14] shadow-sm ${
                puckReady ? "transition-[transform,height] duration-300 ease-out-expo" : ""
              }`}
              style={{ transform: `translateY(${puck.top}px)`, height: puck.height }}
            />
          )}
          {groups.map((group, index) => (
            // Index, not :first-child: the highlight is the nav's first child once it is placed
            <div key={group.label || index} className={index === 0 ? "mt-0" : "mt-7"}>
              {group.label ? (
                <p className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-wider text-shell-muted/80">{group.label}</p>
              ) : null}
              <ul className="space-y-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const key = `${item.to}-${item.label}`;
                  const isActive = key === activeKey;
                  return (
                    <li key={key}>
                      <Link
                        ref={(el) => {
                          if (el) itemRefs.current.set(key, el);
                          else itemRefs.current.delete(key);
                        }}
                        to={item.to}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex min-h-[44px] items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-[14.5px] leading-snug transition-all duration-150 ease-out ${
                          isActive
                            ? "font-semibold text-white shadow-sm"
                            : "text-shell-ink-2 hover:bg-white/[0.12] hover:text-white hover:translate-x-1 hover:shadow-sm"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 transition-all duration-150 ${
                            isActive
                              ? "text-white scale-105"
                              : "text-shell-muted group-hover:text-white group-hover:scale-110"
                          }`}
                          strokeWidth={1.85}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Signed-in user */}
        <div className="border-t border-white/10 p-3.5">
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-white" title={displayName}>
                {displayName}
              </p>
              {user && <p className="text-xs text-shell-muted">{ROLE_LABEL[user.role]}</p>}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-shell-muted transition-colors duration-150 hover:bg-white/10 hover:text-white"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-rule bg-panel px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="-ml-2 rounded-md p-2 text-ink-2 transition-colors duration-150 hover:bg-sunken lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate text-[15px] font-semibold text-ink">
              {getPageTitle(location.pathname, navItems, user?.role)}
            </p>
          </div>
          <Link
            to="/notifications"
            className="relative rounded-md p-2 text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white ring-2 ring-panel">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={location.pathname} className="mx-auto max-w-[1360px] space-y-6 p-4 sm:p-6 lg:px-8 lg:py-7 page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
