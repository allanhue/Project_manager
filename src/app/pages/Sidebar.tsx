import type { ReactNode } from "react";

type PageKey = "dashboard" | "projects" | "tasks" | "analytics" | "profile" | "settings" | "admin";

const menu: Array<{ key: PageKey; label: string; hint: string; icon: ReactNode }> = [
  {
    key: "dashboard",
    label: "Dashboard",
    hint: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 13h8V3H3zM13 21h8v-6h-8zM13 11h8V3h-8zM3 21h8v-6H3z" />
      </svg>
    ),
  },
  {
    key: "projects",
    label: "Projects",
    hint: "Portfolios",
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
    hint: "Execution board",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 11l2 2 4-4" />
        <path d="M4 6h16M4 12h4M4 18h16" />
      </svg>
    ),
  },
  {
    key: "analytics",
    label: "Analytics",
    hint: "Reports",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20h16" />
        <path d="M7 16v-5M12 16V8M17 16v-3" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    hint: "Identity",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c1.8-3.4 4.1-5 7-5s5.2 1.6 7 5" />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Settings",
    hint: "Workspace config",
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
    hint: "Tenant controls",
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
  canViewAdmin: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({ currentPage, onNavigate, canViewAdmin, collapsed, onToggleCollapse }: SidebarProps) {
  const visibleMenu = canViewAdmin ? menu : menu.filter((item) => item.key !== "admin");

  return (
    <aside className={`hidden flex-col border-r border-slate-200 bg-white transition-all md:flex ${collapsed ? "w-20" : "w-72"}`}>
      <div className={`border-b border-slate-200 py-3 ${collapsed ? "px-2" : "px-4"}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 ${collapsed ? "sr-only" : ""}`}>PulseForge</p>
        </div>
      </div>

      <nav className={`flex-1 py-4 ${collapsed ? "px-2" : "px-3"}`}>
        <ul className="space-y-1">
          {visibleMenu.map((item) => {
            const isActive = currentPage === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={`w-full rounded-lg py-2 transition ${collapsed ? "px-2 text-center" : "px-3 text-left"} ${
                    isActive
                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {collapsed ? (
                    <span className="inline-flex items-center justify-center">{item.icon}</span>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex items-center justify-center text-slate-500">{item.icon}</span>
                      <span>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.hint}</p>
                      </span>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
