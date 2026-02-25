type PageKey = "dashboard" | "projects" | "tasks" | "analytics" | "settings" | "admin";

const titles: Record<PageKey, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "Tasks",
  analytics: "Analytics",
  settings: "Settings",
  admin: "Admin",
};

type NavProps = {
  currentPage: PageKey;
};

export function Nav({ currentPage }: NavProps) {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{titles[currentPage]}</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search projects, tasks, activities..."
            className="w-72 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
          />
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
            Allan
          </div>
        </div>
      </div>
    </header>
  );
}
