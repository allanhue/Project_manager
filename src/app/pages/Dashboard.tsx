"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SystemConfigurationPage from "../admin/Configuration";
import DashboardadminPage from "../admin/Dashboardadmin";
import SystemAdminHome from "../admin/Home";
import { AuthUser, getSession, logout } from "../auth/auth";
import { Nav } from "../componets/Nav";
import AnalyticsPage from "./Analytics";
import CalendarPage from "./Calendar";
import ProfilePage from "./Profile";
import ProjectsPage from "./Projects";
import { Sidebar } from "./Sidebar";
import SettingsPage from "./Settings";
import TasksPage from "./Task";

type PageKey = "dashboard" | "projects" | "tasks" | "analytics" | "calendar" | "profile" | "settings" | "admin";

const stats = [
  { label: "Receivables", value: "KES 1.42M", change: "+9% vs last month" },
  { label: "Payables", value: "KES 630K", change: "12 due this week" },
  { label: "Project Revenue", value: "KES 2.87M", change: "Current cycle" },
  { label: "Open Work Orders", value: "28", change: "6 high priority" },
];

const activities = [
  "API migration moved to In Review by Allan Mwangi",
  "Mobile onboarding wireframes approved by Design team",
  "Client feedback added to Sprint 12 backlog",
  "Tenant onboarding checklist updated for Acme Labs",
];

function DashboardOverview() {
  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Workspace Summary</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Business Operations Hub</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <article key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</p>
            <p className="mt-1 text-xs text-slate-600">{item.change}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Cashflow and Delivery Pulse</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              On Track
            </span>
          </div>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="rounded-lg bg-slate-50 px-3 py-2">Pending invoices reduced by 14% this cycle.</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Collections reminders sent to 8 overdue accounts.</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Project delivery throughput improved week-over-week.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Recent Activity</h2>
          <ul className="space-y-3 text-sm text-slate-700">
            {activities.map((activity) => (
              <li key={activity} className="border-l-2 border-slate-200 pl-3">
                {activity}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}

function SystemAdminDashboardPage() {
  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">System Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Operations Control Center</h1>
        <p className="mt-2 text-sm text-slate-600">Central overview for platform health, tenant activity, and support workflow.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Analytics</h2>
          <p className="mt-2 text-sm text-slate-600">
            Open <span className="font-semibold text-slate-900">Analytics</span> to view usage charts, active organizations, and engagement trends.
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Support</h2>
          <p className="mt-2 text-sm text-slate-600">
            Open <span className="font-semibold text-slate-900">Support</span> to inspect logs, debug issues, and send support communication.
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Configuration</h2>
          <p className="mt-2 text-sm text-slate-600">
            Open <span className="font-semibold text-slate-900">Configuration</span> to add and edit tenant details and org IDs.
          </p>
        </article>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

    if (currentPage === "projects") return <ProjectsPage />;
    if (currentPage === "tasks") return <TasksPage />;
    if (currentPage === "analytics") return <AnalyticsPage />;
    if (currentPage === "calendar") return <CalendarPage />;
    if (currentPage === "profile" && user) return <ProfilePage user={user} />;
    if (currentPage === "settings") return <SettingsPage />;
    if (currentPage === "admin") return <DashboardOverview />;
    return <DashboardOverview />;
  }, [currentPage, user]);

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

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">Loading workspace...</div>;
  }

  return (
    <div className={`flex min-h-screen ${isSystemAdmin ? "bg-sky-50 text-slate-900" : "bg-slate-100 text-slate-900"}`}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        role={userRole}
        isSystemAdmin={isSystemAdmin}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Nav
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          userName={user?.name || "User"}
          role={userRole}
          isSystemAdmin={isSystemAdmin}
          onLogout={handleLogout}
        />
        <main className={`flex-1 overflow-y-auto p-4 md:p-6 ${isSystemAdmin ? "bg-sky-50" : ""}`}>{pageContent}</main>
      </div>
    </div>
  );
}
