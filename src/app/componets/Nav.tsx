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
  role: "system_admin" | "org_admin";
  isSystemAdmin: boolean;
  onLogout: () => void;
};

export function Nav({ currentPage, onNavigate, userName, role, isSystemAdmin, onLogout }: NavProps) {
  const pageList: Array<{ key: PageKey; label: string }> =
    role === "system_admin"
      ? [
          { key: "dashboard", label: "Dashboard" },
          { key: "analytics", label: "Analytics" },
          { key: "admin", label: "Support" },
          { key: "settings", label: "Configuration" },
        ]
      : [
          { key: "dashboard", label: "Dashboard" },
          { key: "projects", label: "Projects" },
          { key: "tasks", label: "Tasks" },
          { key: "analytics", label: "Analytics" },
          { key: "profile", label: "Profile" },
          { key: "settings", label: "Settings" },
        ];
  const headerTitle =
    role === "system_admin"
      ? currentPage === "dashboard"
        ? "Dashboard"
        : currentPage === "analytics"
          ? "Analytics"
        : currentPage === "admin"
            ? "Support"
            : currentPage === "settings"
              ? "Configuration"
            : titles[currentPage]
      : titles[currentPage];

  return (
    <header className={`border-b px-4 py-4 md:px-6 ${isSystemAdmin ? "border-sky-200 bg-white" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className={`text-lg font-semibold ${isSystemAdmin ? "text-slate-900" : "text-slate-900"}`}>{headerTitle}</h1>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <label htmlFor="mobile-page" className={`text-xs font-medium ${isSystemAdmin ? "text-slate-600" : "text-slate-500"}`}>
            View
          </label>
          <select
            id="mobile-page"
            value={currentPage}
            onChange={(event) => onNavigate(event.target.value as PageKey)}
            className={`rounded-lg border px-3 py-2 text-sm outline-none ${
              isSystemAdmin ? "border-sky-200 bg-sky-50 text-slate-900 focus:border-sky-400" : "border-slate-300 bg-white focus:border-sky-300"
            }`}
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
            className={`w-full min-w-[180px] rounded-lg border px-3 py-2 text-sm outline-none transition md:w-72 ${
              isSystemAdmin
                ? "border-sky-200 bg-sky-50 text-slate-900 focus:border-sky-400"
                : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-300 focus:bg-white"
            }`}
          />
          <div className={`rounded-full border px-3 py-1.5 text-sm font-medium ${isSystemAdmin ? "border-sky-200 bg-sky-50 text-slate-800" : "border-slate-200 bg-white text-slate-700"}`}>
            {userName}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${isSystemAdmin ? "border-sky-200 bg-sky-50 text-slate-800 hover:bg-sky-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
