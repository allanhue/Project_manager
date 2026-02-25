type PageKey = "dashboard" | "projects" | "tasks" | "analytics" | "profile" | "settings" | "admin";

const titles: Record<PageKey, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "Tasks",
  analytics: "Analytics",
  profile: "Profile",
  settings: "Settings",
  admin: "Admin",
};

type NavProps = {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  userName: string;
  onLogout: () => void;
};

export function Nav({ currentPage, onNavigate, userName, onLogout }: NavProps) {
  const pageList: Array<{ key: PageKey; label: string }> = [
    { key: "dashboard", label: "Dashboard" },
    { key: "projects", label: "Projects" },
    { key: "tasks", label: "Tasks" },
    { key: "analytics", label: "Analytics" },
    { key: "profile", label: "Profile" },
    { key: "settings", label: "Settings" },
    { key: "admin", label: "Admin" },
  ];

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{titles[currentPage]}</h1>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <label htmlFor="mobile-page" className="text-xs font-medium text-slate-500">
            View
          </label>
          <select
            id="mobile-page"
            value={currentPage}
            onChange={(event) => onNavigate(event.target.value as PageKey)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
          >
            {pageList.map((page) => (
              <option key={page.key} value={page.key}>
                {page.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <input
            type="search"
            placeholder="Search projects, tasks, activities..."
            className="w-full min-w-[180px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white md:w-72"
          />
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
            {userName}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
