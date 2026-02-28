"use client";

import { useEffect, useMemo, useState } from "react";
import { getSystemLogs, listProjects, listTasks, Project, TaskItem } from "../auth/auth";

type PageKey = "dashboard" | "projects" | "tasks" | "analytics" | "calendar" | "profile" | "settings" | "admin";

const titles: Record<PageKey, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "Tasks",
  analytics: "Analytics",
  calendar: "Calendar",
  profile: "Profile",
  settings: "Settings",
  admin: "Admin",
};

type NotificationItem = {
  id: string;
  type: "due" | "support" | "system";
  title: string;
  detail: string;
  createdAt?: string;
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const next: NotificationItem[] = [];
      try {
        const [projects, tasks] = await Promise.all([listProjects(), listTasks()]);
        const projectByID = new Map<number, Project>();
        for (const project of projects) {
          projectByID.set(project.id, project);
          if (!project.due_date) continue;
          const due = new Date(project.due_date);
          const now = new Date();
          const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 3) {
            next.push({
              id: `project-due-${project.id}`,
              type: "due",
              title: `Project due: ${project.name}`,
              detail: diffDays < 0 ? "Deadline passed" : `Due in ${diffDays} day(s)`,
              createdAt: project.due_date || undefined,
            });
          }
        }
        for (const task of tasks) {
          if (task.status === "done") continue;
          const project = projectByID.get(task.project_id);
          if (!project?.due_date) continue;
          const due = new Date(project.due_date);
          const now = new Date();
          const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 2) {
            next.push({
              id: `task-due-${task.id}`,
              type: "due",
              title: `Task due soon: ${task.title}`,
              detail: `${task.project_name || project.name} due ${due.toLocaleDateString()}`,
              createdAt: project.due_date || undefined,
            });
          }
        }

        if (role === "system_admin") {
          const logs = await getSystemLogs(40);
          logs
            .filter((log) => log.path.includes("/support/request") || log.path.includes("/system/"))
            .slice(0, 8)
            .forEach((log) => {
              next.push({
                id: `sys-${log.id}`,
                type: log.path.includes("/support/") ? "support" : "system",
                title: log.path.includes("/support/") ? "Support activity" : "System update",
                detail: `${log.method} ${log.path} (${log.status_code})`,
                createdAt: log.created_at,
              });
            });
        }
      } catch {
        next.push({
          id: "notif-load-error",
          type: "system",
          title: "Notifications unavailable",
          detail: "Could not load latest project/task alerts.",
        });
      }

      if (!mounted) return;
      setNotifications(next.slice(0, 20));
    })();
    return () => {
      mounted = false;
    };
  }, [role]);

  const pageList: Array<{ key: PageKey; label: string }> =
    role === "system_admin"
      ? [
          { key: "dashboard", label: "Dashboard" },
          { key: "analytics", label: "Analytics" },
          { key: "calendar", label: "Calendar" },
          { key: "admin", label: "Support" },
          { key: "settings", label: "Configuration" },
        ]
      : [
          { key: "dashboard", label: "Dashboard" },
          { key: "projects", label: "Projects" },
          { key: "tasks", label: "Tasks" },
          { key: "analytics", label: "Analytics" },
          { key: "calendar", label: "Calendar" },
          { key: "profile", label: "Profile" },
          { key: "settings", label: "Settings" },
        ];
  const headerTitle =
    role === "system_admin"
      ? currentPage === "dashboard"
        ? "Dashboard"
        : currentPage === "analytics"
          ? "Analytics"
          : currentPage === "calendar"
            ? "Calendar"
            : currentPage === "admin"
              ? "Support"
              : currentPage === "settings"
                ? "Configuration"
                : titles[currentPage]
      : titles[currentPage];

  const unreadCount = useMemo(() => notifications.length, [notifications]);

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
        <div className="relative flex flex-wrap items-center gap-2 md:gap-3">
          <input
            type="search"
            placeholder="Search projects, tasks, activities..."
            className={`w-full min-w-[180px] rounded-lg border px-3 py-2 text-sm outline-none transition md:w-72 ${
              isSystemAdmin
                ? "border-sky-200 bg-sky-50 text-slate-900 focus:border-sky-400"
                : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-300 focus:bg-white"
            }`}
          />

          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className={`relative rounded-lg border px-3 py-2 text-sm transition hover:-translate-y-[1px] ${isSystemAdmin ? "border-sky-200 bg-sky-50 text-slate-800 hover:bg-sky-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            aria-label="Notifications"
          >
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M10 18a2 2 0 0 0 4 0" />
              </svg>
              <span>Alerts</span>
            </span>
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>

          {role === "org_admin" ? (
            <button
              type="button"
              onClick={() => setHelpOpen((prev) => !prev)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:-translate-y-[1px] hover:bg-slate-50"
              aria-label="Help"
            >
              <span className="inline-flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.1 9a3 3 0 1 1 4.7 2.5c-.7.5-1.3.9-1.3 1.8v.2" />
                  <circle cx="12" cy="17" r="1" />
                </svg>
                <span>Help</span>
              </span>
            </button>
          ) : null}

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

      {notifOpen ? (
        <div className="fixed inset-0 z-40">
          <button type="button" onClick={() => setNotifOpen(false)} className="absolute inset-0 bg-slate-950/35" aria-label="Close notifications" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <button type="button" onClick={() => setNotifOpen(false)} className="text-xs text-slate-500">
                Close
              </button>
            </div>
            <div className="h-[calc(100%-56px)] space-y-2 overflow-auto p-4">
              {notifications.length === 0 ? <p className="text-sm text-slate-600">No notifications right now.</p> : null}
              {notifications.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        item.type === "due"
                          ? "bg-amber-100 text-amber-800"
                          : item.type === "support"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {item.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                  {item.createdAt ? <p className="mt-1 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p> : null}
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {helpOpen ? (
        <div className="fixed inset-0 z-40">
          <button type="button" onClick={() => setHelpOpen(false)} className="absolute inset-0 bg-slate-950/25" aria-label="Close help" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Quick Help</p>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-xs text-slate-500">
                Close
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm text-slate-700">
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Projects</p>
                <p className="mt-1">Create projects with timeline and team size so deadlines and alerts work properly.</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Tasks</p>
                <p className="mt-1">Every task must be linked to a project. Add subtasks line-by-line in the form.</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Calendar</p>
                <p className="mt-1">Use calendar to track starts, due dates, and upcoming pressure points.</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Support</p>
                <p className="mt-1">Open Settings to submit support requests to system administration.</p>
              </article>
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
