"use client";

import { useMemo, useState } from "react";
import AdminPage from "../admin/admin";
import { Nav } from "../componets/Nav";
import AnalyticsPage from "./Analytics";
import ProjectsPage from "./Projects";
import { Sidebar } from "./Sidebar";
import SettingsPage from "./Settings";
import TasksPage from "./Task";

type PageKey = "dashboard" | "projects" | "tasks" | "analytics" | "settings" | "admin";

const stats = [
  { label: "Active Projects", value: "18", change: "+3 this month" },
  { label: "Open Tasks", value: "143", change: "21 overdue" },
  { label: "Team Members", value: "34", change: "4 invited today" },
  { label: "Milestones", value: "12", change: "6 due this week" },
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
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Program Control Center</h1>
        <p className="mt-1 text-sm text-slate-600">
          Keep project operations clean and visible before multi-tenant auth wiring.
        </p>
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
            <h2 className="text-sm font-semibold text-slate-900">Current Sprint Progress</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              On Track
            </span>
          </div>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="rounded-lg bg-slate-50 px-3 py-2">Planning and estimation complete for Sprint 12.</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Backend API sync status documented for all modules.</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">
              UI tickets grouped by pages then shared components, as requested.
            </li>
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

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard");

  const pageContent = useMemo(() => {
    if (currentPage === "projects") return <ProjectsPage />;
    if (currentPage === "tasks") return <TasksPage />;
    if (currentPage === "analytics") return <AnalyticsPage />;
    if (currentPage === "settings") return <SettingsPage />;
    if (currentPage === "admin") return <AdminPage />;
    return <DashboardOverview />;
  }, [currentPage]);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Nav currentPage={currentPage} />
        <main className="flex-1 overflow-y-auto p-6">{pageContent}</main>
      </div>
    </div>
  );
}
