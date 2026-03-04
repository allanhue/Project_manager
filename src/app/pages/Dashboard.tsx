"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SystemConfigurationPage from "../system_admin/Configuration";
import DashboardadminPage from "../system_admin/Dashboardadmin";
import SystemAdminHome from "../system_admin/Home";
import { AuthUser, getSession, getSystemAnalytics, getSystemLogs, getSystemUpdates, listProjects, listTasks, logout, SystemAnalytics, SystemLog, SystemUpdate } from "../auth/auth";
import { Nav } from "../componets/Nav";
import { LoadingSpinner } from "../componets/LoadingSpinner";
import AnalyticsPage from "./Analytics";
import CalendarPage from "./Calendar";
import ForumPage from "./Forum";
import IssuesPage from "./Issues";
import ProfilePage from "./Profile";
import ProjectsPage from "./Projects";
import ReportsPage from "./Reports";
import { Sidebar } from "./Sidebar";
import SettingsPage from "./Settings";
import TasksPage from "./Task";
import TimesheetsPage from "./Timesheets";

type PageKey = "dashboard" | "projects" | "tasks" | "timesheets" | "analytics" | "reports" | "calendar" | "forum" | "issues" | "profile" | "settings" | "admin";

function DashboardOverview({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const [projectCount, setProjectCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [doneTaskCount, setDoneTaskCount] = useState(0);
  const [pendingProjectCount, setPendingProjectCount] = useState(0);
  const [recentProjects, setRecentProjects] = useState<Array<{ id: number; name: string; status: string; assignees: number }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [projects, tasks] = await Promise.all([listProjects(), listTasks()]);
        if (!mounted) return;
        const doneTasks = tasks.filter((item) => {
          const normalized = item.status.trim().toLowerCase();
          return normalized === "done" || normalized === "completed" || normalized === "closed";
        }).length;
        const pendingProjects = projects.filter((item) => item.status.trim().toLowerCase() === "pending").length;
        setProjectCount(projects.length);
        setTaskCount(tasks.length);
        setDoneTaskCount(doneTasks);
        setPendingProjectCount(pendingProjects);
        setRecentProjects(
          projects.slice(0, 6).map((item) => ({
            id: item.id,
            name: item.name,
            status: item.status,
            assignees: (item.assignees || []).length,
          })),
        );
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const completion = taskCount > 0 ? Math.round((doneTaskCount / taskCount) * 100) : 0;
  const announcements = [
    `You have ${pendingProjectCount} pending project(s) that need closure.`,
    `${taskCount - doneTaskCount} task(s) still open across your workspace.`,
    "Use Calendar to track pressure points and due windows.",
  ];

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Workspace Summary</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Business Operations Hub</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate("projects")} className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>
              New Project
            </button>
            <button onClick={() => onNavigate("tasks")} className="inline-flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l2 2 4-4"/></svg>
              New Task
            </button>
            <button onClick={() => onNavigate("calendar")} className="inline-flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Export
            </button>
          </div>
        </div>
      </header>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Projects</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{projectCount}</p>
          <p className="mt-1 text-xs text-slate-600">{pendingProjectCount} pending</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tasks</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{taskCount}</p>
          <p className="mt-1 text-xs text-slate-600">{doneTaskCount} done</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completion</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{completion}%</p>
          <p className="mt-1 text-xs text-slate-600">based on task statuses</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Health</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{completion >= 75 ? "Good" : completion >= 50 ? "Watch" : "Risk"}</p>
          <p className="mt-1 text-xs text-slate-600">delivery posture</p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Announcements</h2>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              Live
            </span>
          </div>
          <ul className="space-y-3 text-sm text-slate-700">
            {announcements.map((line) => (
              <li key={line} className="rounded-lg bg-slate-50 px-3 py-2">{line}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Type Snapshot</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Count</th>
                  <th className="px-2 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100"><td className="px-2 py-2">Projects</td><td className="px-2 py-2">{projectCount}</td><td className="px-2 py-2 text-slate-600">{pendingProjectCount} pending</td></tr>
                <tr className="border-b border-slate-100"><td className="px-2 py-2">Tasks</td><td className="px-2 py-2">{taskCount}</td><td className="px-2 py-2 text-slate-600">{taskCount - doneTaskCount} open</td></tr>
                <tr><td className="px-2 py-2">Recent Projects</td><td className="px-2 py-2">{recentProjects.length}</td><td className="px-2 py-2 text-slate-600">latest added</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function SystemAdminDashboardPage() {
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [a, u, l] = await Promise.all([getSystemAnalytics(), getSystemUpdates(), getSystemLogs(50)]);
        if (!mounted) return;
        setAnalytics(a);
        setUpdates(u.slice(0, 5));
        setLogs(l);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load system dashboard.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const healthLogs = logs
    .filter((item) => item.status_code >= 400 || item.latency_ms >= 800 || item.path.includes("/health"))
    .slice(0, 8);

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">System Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Operations Control Center</h1>
        <p className="mt-2 text-sm text-slate-600">Central overview for platform health, tenant activity, and support workflow.</p>
      </header>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Tenants</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.tenant_count ?? "-"}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Active Users (24h)</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.active_users_24h ?? "-"}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Active Tenants (7d)</p><p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.active_tenants_7d ?? "-"}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">System Health Alerts</p><p className="mt-2 text-2xl font-semibold text-slate-900">{healthLogs.length}</p></article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Announcements</h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {updates.length === 0 ? <li className="rounded-lg bg-slate-50 px-3 py-2">No upcoming announcements.</li> : null}
            {updates.map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                {item.scheduled_date}: {item.title}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">System Health (compact)</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200"><th className="px-2 py-2 font-medium">Time</th><th className="px-2 py-2 font-medium">Path</th><th className="px-2 py-2 font-medium">Status</th><th className="px-2 py-2 font-medium">Latency</th></tr>
              </thead>
              <tbody>
                {healthLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-slate-700">{new Date(log.created_at).toLocaleTimeString()}</td>
                    <td className="px-2 py-2 text-slate-700">{log.path}</td>
                    <td className="px-2 py-2 text-slate-700">{log.status_code}</td>
                    <td className="px-2 py-2 text-slate-700">{log.latency_ms}ms</td>
                  </tr>
                ))}
                {healthLogs.length === 0 ? <tr><td className="px-2 py-2 text-slate-500" colSpan={4}>No health alerts.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/auth");
      return;
    }
    setUser(session.user);
    setReady(true);
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/auth");
  }

  const canViewAdmin = user?.role === "system_admin";
  const userRole = user?.role || "org_admin";
  const isSystemAdmin = userRole === "system_admin";

  const pageContent = useMemo(() => {
    if (user?.role === "system_admin") {
      if (currentPage === "admin") return <SystemAdminHome />;
      if (currentPage === "analytics") return <DashboardadminPage />;
      if (currentPage === "calendar") return <CalendarPage />;
      if (currentPage === "settings") return <SystemConfigurationPage />;
      return <SystemAdminDashboardPage />;
    }

    if (currentPage === "projects") return <ProjectsPage searchQuery={searchQuery} />;
    if (currentPage === "tasks") return <TasksPage searchQuery={searchQuery} />;
    if (currentPage === "timesheets") return <TimesheetsPage searchQuery={searchQuery} />;
    if (currentPage === "analytics") return <AnalyticsPage searchQuery={searchQuery} />;
    if (currentPage === "reports") return <ReportsPage searchQuery={searchQuery} />;
    if (currentPage === "calendar") return <CalendarPage />;
    if (currentPage === "forum") return <ForumPage searchQuery={searchQuery} />;
    if (currentPage === "issues") return <IssuesPage searchQuery={searchQuery} />;
    if (currentPage === "profile" && user) return <ProfilePage user={user} />;
    if (currentPage === "settings") return <SettingsPage />;
    if (currentPage === "admin") return <DashboardOverview onNavigate={setCurrentPage} />;
    return <DashboardOverview onNavigate={setCurrentPage} />;
  }, [currentPage, searchQuery, user]);

  useEffect(() => {
    if (user?.role === "system_admin") {
      if (currentPage !== "dashboard" && currentPage !== "analytics" && currentPage !== "calendar" && currentPage !== "admin" && currentPage !== "settings") {
        setCurrentPage("dashboard");
      }
      return;
    }
    if (currentPage === "admin" && !canViewAdmin) {
      setCurrentPage("dashboard");
    }
  }, [canViewAdmin, currentPage, user?.role]);

  useEffect(() => {
    setSearchQuery("");
  }, [currentPage]);

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-100">
        <LoadingSpinner label="Loading workspace..." />
      </div>
    );
  }

  return (
    <div className={`flex h-dvh overflow-hidden ${isSystemAdmin ? "bg-sky-50 text-slate-900" : "bg-slate-100 text-slate-900"}`}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        role={userRole}
        isSystemAdmin={isSystemAdmin}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Nav
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          userName={user?.name || "User"}
          orgId={user?.tenantSlug || ""}
          role={userRole}
          isSystemAdmin={isSystemAdmin}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLogout={handleLogout}
        />
        <main className={`min-h-0 flex-1 overflow-y-auto p-4 md:p-6 ${isSystemAdmin ? "bg-sky-50" : ""}`}>{pageContent}</main>
      </div>
    </div>
  );
}
