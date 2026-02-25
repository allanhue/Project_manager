type PageKey = "dashboard" | "projects" | "tasks" | "analytics" | "profile" | "settings" | "admin";

const menu: Array<{ key: PageKey; label: string; hint: string }> = [
  { key: "dashboard", label: "Dashboard", hint: "Overview" },
  { key: "projects", label: "Projects", hint: "Portfolios" },
  { key: "tasks", label: "Tasks", hint: "Execution board" },
  { key: "analytics", label: "Analytics", hint: "Reports" },
  { key: "profile", label: "Profile", hint: "Identity" },
  { key: "settings", label: "Settings", hint: "Workspace config" },
  { key: "admin", label: "Admin", hint: "Tenant controls" },
];

type SidebarProps = {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
};

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PulseForge</p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {menu.map((item) => {
            const isActive = currentPage === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${
                    isActive
                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.hint}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
