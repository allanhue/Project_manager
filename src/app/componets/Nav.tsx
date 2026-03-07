"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNotification, NotificationSummary, listNotifications, markNotificationRead, sendSupportRequest } from "../auth/auth";

type PageKey = "dashboard" | "projects" | "tasks" | "timesheets" | "analytics" | "reports" | "calendar" | "approvals" | "forum" | "issues" | "profile" | "settings" | "admin";

const titles: Record<PageKey, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "Tasks",
  timesheets: "Timesheets",
  analytics: "Analytics",
  reports: "Reports",
  calendar: "Calendar",
  approvals: "Approvals",
  forum: "Forum",
  issues: "Issues",
  profile: "Profile",
  settings: "Settings",
  admin: "Admin",
};

type NavProps = {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  userName: string;
  orgId?: string;
  role: "system_admin" | "org_admin";
  isSystemAdmin: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onLogout: () => void;
};

export function Nav({ currentPage, onNavigate, userName, orgId, role, isSystemAdmin, searchQuery, onSearchChange, onLogout }: NavProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportPriority, setSupportPriority] = useState("normal");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | undefined>(undefined);
  const [dismissedToastIds, setDismissedToastIds] = useState<string[]>([]);

  const refreshNotifications = useCallback(async () => {
    try {
      const payload = await listNotifications(40);
      setNotifications(payload.items);
      setSummary(payload.summary);
    } catch {
      setNotifications([
        {
          id: "notif-load-error",
          tenant_id: orgId || "",
          recipient_email: userName,
          type: "system",
          title: "Notifications unavailable",
          detail: "Could not sync reminders right now.",
          created_at: new Date().toISOString(),
        },
      ]);
    }
  }, [orgId, userName]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await refreshNotifications();
    };
    void run();
    const timer = window.setInterval(() => {
      void run();
    }, 60000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [refreshNotifications]);

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
          { key: "timesheets", label: "Timesheets" },
          { key: "analytics", label: "Analytics" },
          { key: "calendar", label: "Calendar" },
          { key: "approvals", label: "Approvals" },
          { key: "reports", label: "Reports" },
          { key: "forum", label: "Forum" },
          { key: "issues", label: "Issues" },
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

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at && item.type !== "summary").length,
    [notifications],
  );
  const reminderStack = useMemo(
    () => notifications.filter((item) => item.type !== "summary" && !dismissedToastIds.includes(item.id)).slice(0, 3),
    [notifications, dismissedToastIds],
  );
  const searchPlaceholder =
    currentPage === "projects"
      ? "Search projects, assignees..."
        : currentPage === "tasks"
          ? "Search tasks, subtasks..."
          : currentPage === "timesheets"
            ? "Search timesheet notes, projects..."
          : currentPage === "reports"
            ? "Search reports, projects..."
          : currentPage === "calendar"
          ? "Search calendar updates..."
          : currentPage === "approvals"
            ? "Search approval requests..."
          : currentPage === "forum"
            ? "Search forum posts..."
            : currentPage === "issues"
              ? "Search issues..."
              : "Search this module...";

  return (
    <header className={`px-4 py-4 md:px-6 bg-white`}>
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
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className={`w-full min-w-[180px] rounded-lg border px-3 py-2 text-sm outline-none transition md:w-72 ${
              isSystemAdmin
                ? "border-sky-200 bg-sky-50 text-slate-900 focus:border-sky-400"
                : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-300 focus:bg-white"
            }`}
          />

          <div className={`inline-flex items-center gap-2 rounded-xl bg-slate-50 p-1`}>
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition hover:translate-y-0.5`}
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M10 18a2 2 0 0 0 4 0" />
              </svg>
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>

            {role === "org_admin" ? (
              <button
                type="button"
                onClick={() => setSupportOpen((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100"
                aria-label="Support mailbox"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 8 8 6 8-6" />
                </svg>
              </button>
            ) : null}

            {role === "org_admin" ? (
              <button
                type="button"
                onClick={() => setHelpOpen((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100"
                aria-label="Help"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.1 9a3 3 0 1 1 4.7 2.5c-.7.5-1.3.9-1.3 1.8v.2" />
                  <circle cx="12" cy="17" r="1" />
                </svg>
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${isSystemAdmin ? "border-sky-200 bg-sky-50 text-slate-800 hover:bg-sky-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            aria-label="Open profile"
            title={role === "org_admin" ? "Profile" : "Account settings"}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.1" />
              <path d="M5 20c1.6-3.2 3.9-4.8 7-4.8s5.4 1.6 7 4.8" />
            </svg>
          </button>

        </div>
      </div>

      {notifOpen ? (
        <div className="fixed inset-0 z-40">
          <button type="button" onClick={() => setNotifOpen(false)} className="absolute inset-0 bg-slate-950/35" aria-label="Close notifications" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => void refreshNotifications()} className="text-xs text-slate-500">
                  Sync
                </button>
                <button type="button" onClick={() => setNotifOpen(false)} className="text-xs text-slate-500">
                  Close
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-56px)] space-y-2 overflow-auto p-4">
              {summary ? (
                <article className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Reminder Summary</p>
                  <p className="mt-1 text-xs text-slate-700">
                    Pending: {summary.pending_projects} | Assigned: {summary.assigned_pending_projects} | Overdue: {summary.overdue_projects} | Open tasks:{" "}
                    {summary.open_tasks}
                  </p>
                </article>
              ) : null}
              {notifications.length === 0 ? <p className="text-sm text-slate-600">No notifications right now.</p> : null}
              {notifications.map((item) => (
                <article
                  key={item.id}
                  onClick={async () => {
                    if (item.read_at || !/^\d+$/.test(item.id)) return;
                    try {
                      await markNotificationRead(item.id);
                      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
                    } catch {
                      // keep drawer usable if read state update fails
                    }
                  }}
                  className={`rounded-lg border px-3 py-2 ${
                    item.read_at ? "border-slate-200 bg-slate-50" : "cursor-pointer border-sky-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        item.type === "project"
                          ? "bg-amber-100 text-amber-800"
                          : item.type === "support"
                            ? "bg-sky-100 text-sky-800"
                            : item.type === "summary"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {item.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                  {item.created_at ? <p className="mt-1 text-[11px] text-slate-500">{new Date(item.created_at).toLocaleString()}</p> : null}
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {reminderStack.length > 0 ? (
        <div className="fixed bottom-4 right-4 z-30 hidden w-80 space-y-2 md:block">
          {reminderStack.map((item) => (
            <article key={`toast-${item.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
              <div className="mb-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setDismissedToastIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Dismiss notification"
                  title="Dismiss"
                >
                  x
                </button>
              </div>
              <div className="mb-1 h-1 w-full rounded-full bg-slate-100">
                <div className={`h-1 rounded-full ${item.type === "project" ? "bg-amber-400" : "bg-sky-500"}`} style={{ width: "68%" }} />
              </div>
              <p className="text-xs font-semibold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">{item.detail}</p>
            </article>
          ))}
        </div>
      ) : null}

      {profileOpen ? (
        <div className="fixed inset-0 z-40">
          <button type="button" onClick={() => setProfileOpen(false)} className="absolute inset-0 bg-slate-950/10" aria-label="Close profile menu" />
          <aside className="absolute right-4 top-16 w-72 rounded-lg bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Account</p>
              <button type="button" onClick={() => setProfileOpen(false)} className="text-xs text-slate-500">Close</button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="font-medium text-slate-900 truncate">{userName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Organization ID</p>
                <p className="font-medium text-slate-900 truncate">{orgId || "-"}</p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                  className="w-full rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Sign out
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onNavigate(role === "org_admin" ? "profile" : "settings");
                  }}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Open profile
                </button>
              </div>
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

      {supportOpen ? (
        <div className="fixed inset-0 z-40">
          <button type="button" onClick={() => setSupportOpen(false)} className="absolute inset-0 bg-slate-950/25" aria-label="Close support" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Support Mailbox</p>
              <button type="button" onClick={() => setSupportOpen(false)} className="text-xs text-slate-500">
                Close
              </button>
            </div>
            <form
              className="space-y-3 p-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setSupportStatus("Sending...");
                try {
                  const response = await sendSupportRequest({ subject: supportSubject, priority: supportPriority, message: supportMessage });
                  setSupportStatus(response.message || response.status || "Support request sent.");
                  setSupportSubject("");
                  setSupportPriority("normal");
                  setSupportMessage("");
                } catch (err) {
                  setSupportStatus(err instanceof Error ? err.message : "Failed to send support request.");
                }
              }}
            >
              <input
                type="text"
                required
                value={supportSubject}
                onChange={(event) => setSupportSubject(event.target.value)}
                placeholder="Subject"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
              <select
                value={supportPriority}
                onChange={(event) => setSupportPriority(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
              >
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
              <textarea
                required
                rows={6}
                value={supportMessage}
                onChange={(event) => setSupportMessage(event.target.value)}
                placeholder="Describe the issue and impact."
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
              <div className="flex items-center justify-between gap-3">
                {supportStatus ? <p className="text-xs text-slate-600">{supportStatus}</p> : <span />}
                <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                  Send
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
