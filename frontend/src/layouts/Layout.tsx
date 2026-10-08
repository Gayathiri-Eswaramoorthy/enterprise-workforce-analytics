import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import type { UserRole } from "../types";
import { BrandMark } from "../components/BrandMark";
import {
  LayoutDashboard,
  Users,
  Building2,
  Layers,
  Activity,
  ListChecks,
  GraduationCap,
  ScrollText,
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

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL_ROLES: UserRole[] = ["HR_ADMIN", "HR_MANAGER", "EMPLOYEE"];
const HR_ROLES: UserRole[] = ["HR_ADMIN", "HR_MANAGER"];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Retention",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard, roles: HR_ROLES },
      { to: "/", label: "My dashboard", icon: LayoutDashboard, roles: ["EMPLOYEE"] },
      { to: "/predictions", label: "Attrition risk", icon: Activity, roles: HR_ROLES },
      { to: "/recommendations", label: "Actions", icon: ListChecks, roles: HR_ROLES },
    ],
  },
  {
    label: "Talent",
    items: [
      { to: "/employees", label: "People", icon: Users, roles: HR_ROLES },
      { to: "/departments", label: "Departments", icon: Building2, roles: ALL_ROLES },
      { to: "/skills", label: "Skills", icon: Layers, roles: ALL_ROLES },
      { to: "/training", label: "Training", icon: GraduationCap, roles: ALL_ROLES },
    ],
  },
  {
    label: "Admin",
    items: [{ to: "/audit-logs", label: "Audit log", icon: ScrollText, roles: ["HR_ADMIN"] }],
  },
];

const ROLE_LABEL: Record<UserRole, string> = {
  HR_ADMIN: "HR admin",
  HR_MANAGER: "HR manager",
  EMPLOYEE: "Employee",
};

const getPageTitle = (pathname: string, items: NavItem[]): string => {
  const navMatch = items.find((item) => item.to === pathname);
  if (navMatch) return navMatch.label;
  if (pathname === "/notifications") return "Notifications";
  if (pathname.startsWith("/employees/")) return "Employee profile";
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
    return () => clearInterval(interval);
    // Re-check after navigating (e.g. leaving the Notifications page after reading them)
  }, [location.pathname]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => user && item.roles.includes(user.role)),
  })).filter((group) => group.items.length > 0);
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
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-shrink-0 flex-col bg-shell text-shell-ink transition-transform duration-300 ease-out-expo lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Main navigation"
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
          <Link to="/" className="flex items-center gap-2.5 rounded-md">
            <BrandMark className="h-[7px] w-[23px]" />
            <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-white">
              Workforce Analytics
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-shell-muted hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 pb-6 pt-3">
          {puck && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-3 right-3 top-0 rounded-md bg-white/[0.12] ${
                puckReady ? "transition-[transform,height] duration-300 ease-out-expo" : ""
              }`}
              style={{ transform: `translateY(${puck.top}px)`, height: puck.height }}
            />
          )}
          {groups.map((group, index) => (
            // Index, not :first-child: the highlight is the nav's first child once it is placed
            <div key={group.label} className={index === 0 ? "mt-0" : "mt-6"}>
              <p className="px-3 pb-1.5 text-xs font-medium text-shell-muted">{group.label}</p>
              <ul className="space-y-0.5">
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
                        className={`relative flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] transition-colors duration-150 ease-out ${
                          isActive
                            ? "font-medium text-white"
                            : "text-shell-ink-2 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 transition-colors duration-150 ${
                            isActive ? "text-white" : "text-shell-muted"
                          }`}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Signed-in user */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white" title={displayName}>
                {displayName}
              </p>
              {user && <p className="text-xs text-shell-muted">{ROLE_LABEL[user.role]}</p>}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-1.5 text-shell-muted transition-colors duration-150 hover:bg-white/10 hover:text-white"
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
        <header className="z-10 flex h-14 flex-shrink-0 items-center justify-between border-b border-rule bg-panel px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="-ml-2 rounded-md p-2 text-ink-2 transition-colors duration-150 hover:bg-sunken lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate text-[15px] font-semibold text-ink">
              {getPageTitle(location.pathname, navItems)}
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
          <div className="mx-auto max-w-[1360px] space-y-6 p-4 sm:p-6 lg:px-8 lg:py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
