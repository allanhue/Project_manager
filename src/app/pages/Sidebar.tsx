"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listProjects, Project } from "../auth/auth";

type PageKey = "dashboard" | "projects" | "tasks" | "timesheets" | "analytics" | "reports" | "calendar" | "forum" | "issues" | "profile" | "settings" | "admin";

const menu: Array<{ key: PageKey; label: string; icon: ReactNode }> = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 13h8V3H3zM13 21h8v-6h-8zM13 11h8V3h-8zM3 21h8v-6H3z" />
      </svg>
    ),
  },
  {
    key: "projects",
    label: "Projects",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7h18v12H3z" />
        <path d="M8 7V5h8v2" />
      </svg>
    ),
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 11l2 2 4-4" />
        <path d="M4 6h16M4 12h4M4 18h16" />
      </svg>
    ),
  },
  {
    key: "timesheets",
    label: "Timesheets",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 5h16v14H4z" />
        <path d="M8 3v4M16 3v4M4 9h16M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20h16" />
        <path d="M7 16v-5M12 16V8M17 16v-3" />
      </svg>
    ),
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16v13H4z" />
        <path d="M8 3v4M16 3v4M4 11h16" />
      </svg>
    ),
  },
  {
    key: "reports",
    label: "Reports",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 5h14v14H5z" />
        <path d="M8 16V9M12 16V7M16 16v-4" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c1.8-3.4 4.1-5 7-5s5.2 1.6 7 5" />
      </svg>
    ),
  },
  {
    key: "forum",
    label: "Forum",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 5h16v10H8l-4 4z" />
      </svg>
    ),
  },
  {
    key: "issues",
    label: "Issues",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 9v4" />
        <circle cx="12" cy="17" r="1" />
        <path d="M10.3 3.4 2.9 17.1a1.5 1.5 0 0 0 1.3 2.2h15.6a1.5 1.5 0 0 0 1.3-2.2L13.7 3.4a1.5 1.5 0 0 0-3.4 0z" />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 1 0 12 8.5z" />
        <path d="M4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4" />
      </svg>
    ),
  },
  {
    key: "admin",
    label: "Admin",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l7 3v5c0 4.5-3.2 8.5-7 10-3.8-1.5-7-5.5-7-10V6z" />
        <path d="M9.5 12.5 11 14l3.5-3.5" />
      </svg>
    ),
  },
];

type SidebarProps = {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  role: "system_admin" | "org_admin";
  isSystemAdmin: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  orgName?: string;
  orgLogoUrl?: string;
};

export function Sidebar({ currentPage, onNavigate, role, isSystemAdmin, collapsed, onToggleCollapse, orgName, orgLogoUrl }: SidebarProps) {
  const visibleMenu =
    role === "system_admin"
      ? menu.filter((item) => item.key === "dashboard" || item.key === "analytics" || item.key === "calendar" || item.key === "admin")
      : menu.filter((item) => item.key !== "admin" && item.key !== "profile" && item.key !== "settings");
  const bottomMenu =
    role === "system_admin"
      ? menu.filter((item) => item.key === "settings")
      : menu.filter((item) => item.key === "profile" || item.key === "settings");
  const [ongoingProjects, setOngoingProjects] = useState<Project[]>([]);

  useEffect(() => {
    let mounted = true;
    if (role !== "org_admin") return () => { mounted = false; };
    (async () => {
      try {
        const projects = await listProjects();
        if (!mounted) return;
        setOngoingProjects(projects);
      } catch {
        if (!mounted) return;
        setOngoingProjects([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [role]);

  const quickProjects = useMemo(() => {
    const activeItems = ongoingProjects.filter((item) => {
      const status = item.status.trim().toLowerCase();
      return status !== "done" && status !== "completed" && status !== "closed";
    });
    return activeItems.slice(0, 5);
  }, [ongoingProjects]);

  function displayLabel(key: PageKey, fallback: string) {
    if (role !== "system_admin") return fallback;
    if (key === "dashboard") return "Dashboard";
    if (key === "analytics") return "Analytics";
    if (key === "admin") return "Support";
    if (key === "settings") return "Configuration";
    return fallback;
  }

  const headerOrgName = (orgName || "").trim() || (role === "system_admin" ? "System Admin" : "Organization");
  const orgInitial = headerOrgName.slice(0, 1).toUpperCase();
  const headerLogo = (orgLogoUrl || "").trim() || "/brand-logo.jpg";

  return (
    <aside
      className={`hidden min-h-0 flex-col overflow-hidden border-r border-slate-200 transition-[width] duration-300 ease-in-out md:sticky md:top-0 md:flex md:h-dvh md:shrink-0 ${collapsed ? "w-20" : "w-72"} ${
        isSystemAdmin ? "bg-white text-slate-900 shadow-sm" : "bg-white"
      }`}
    >
      <div className={`shrink-0 py-3 ${collapsed ? "px-2" : "px-4"} ${isSystemAdmin ? "bg-sky-50/70" : ""}`}>
        <div className={`flex ${collapsed ? "justify-center" : "items-center justify-between"} gap-2`}>
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-2">
              {headerLogo ? (
                <img src={headerLogo} alt={`${headerOrgName} logo`} className="h-8 w-8 rounded-md border border-slate-200 object-cover" />
              ) : (
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold ${isSystemAdmin ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}`}>
                  {orgInitial || "O"}
                </span>
              )}
              <p className={`truncate text-sm font-semibold ${isSystemAdmin ? "text-sky-800" : "text-slate-800"}`}>{headerOrgName}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              isSystemAdmin ? "border-sky-200 text-sky-700 hover:bg-sky-100" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
        <ul className="space-y-1 pb-2">
          {visibleMenu.map((item) => {
            const isActive = currentPage === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={`w-full min-h-[40px] rounded-lg py-2 transition-all duration-200 ${collapsed ? "px-2 text-center" : "px-3 text-left"} ${
                    isActive
                      ? isSystemAdmin
                        ? "bg-sky-100 text-sky-900 ring-1 ring-sky-300"
                        : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                      : isSystemAdmin
                        ? "text-slate-700 hover:-translate-y-[1px] hover:bg-sky-50 hover:text-slate-900"
                        : "text-slate-700 hover:-translate-y-[1px] hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {collapsed ? (
                    <span className="inline-flex items-center justify-center">{item.icon}</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className={`mt-0.5 inline-flex items-center justify-center ${isSystemAdmin ? "text-sky-700" : "text-slate-500"}`}>{item.icon}</span>
                      <span className="text-sm font-medium">{displayLabel(item.key, item.label)}</span>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {!collapsed && role === "org_admin" ? (
        <section className="shrink-0 border-t border-slate-200 px-3 py-3">
          {/* <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate("projects")}
              className="text-[11px] font-medium text-sky-700 hover:text-sky-800"
            >
              View
            </button>
          </div> */}
          <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
            {quickProjects.length === 0 ? <p className="rounded-md bg-slate-50 px-2 py-2 text-xs text-slate-500">No active projects.</p> : null}
            {quickProjects.map((project) => (
              <button
                key={`quick-project-${project.id}`}
                type="button"
                onClick={() => onNavigate("projects")}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left hover:bg-slate-50"
                title={project.name}
              >
                <p className="truncate text-xs font-medium text-slate-800">{project.name}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{project.status || "active"}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className={`shrink-0 border-t ${isSystemAdmin ? "border-sky-100" : "border-slate-200"} py-3 ${collapsed ? "px-2" : "px-3"}`}>
        <ul className="space-y-1">
          {bottomMenu.map((item) => {
            const isActive = currentPage === item.key;
            const isHelp = item.key === "settings";
            const icon = isHelp ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.2 9a2.9 2.9 0 1 1 4.4 2.4c-.6.4-1.2.8-1.2 1.6v.3" />
                <circle cx="12" cy="17" r="1" />
              </svg>
            ) : (
              item.icon
            );
            const label = role === "system_admin" ? "Help & Config" : item.key === "settings" ? "Help & Settings" : "Profile";

            return (
              <li key={`bottom-${item.key}`}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={`w-full min-h-[40px] rounded-lg py-2 transition-all duration-200 ${collapsed ? "px-2 text-center" : "px-3 text-left"} ${
                    isActive
                      ? isSystemAdmin
                        ? "bg-sky-100 text-sky-900 ring-1 ring-sky-300"
                        : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                      : isSystemAdmin
                        ? "text-slate-700 hover:-translate-y-[1px] hover:bg-sky-50 hover:text-slate-900"
                        : "text-slate-700 hover:-translate-y-[1px] hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {collapsed ? (
                    <span className="inline-flex items-center justify-center">{icon}</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className={`mt-0.5 inline-flex items-center justify-center ${isSystemAdmin ? "text-sky-700" : "text-slate-500"}`}>{icon}</span>
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
