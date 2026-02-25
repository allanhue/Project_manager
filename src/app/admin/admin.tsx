"use client";

import { useEffect, useMemo, useState } from "react";
import { listProjects, listTasks, sendTestNotification } from "../auth/auth";

export default function TenantAdminPage() {
  const [projectCount, setProjectCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [error, setError] = useState("");
  const [mailStatus, setMailStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [projects, tasks] = await Promise.all([listProjects(), listTasks()]);
        if (!mounted) return;
        setProjectCount(projects.length);
        setTaskCount(tasks.length);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load tenant admin data.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const health = useMemo(() => {
    if (taskCount === 0) return "No task data yet";
    if (taskCount > projectCount * 5) return "High task load";
    return "Stable";
  }, [projectCount, taskCount]);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Organization Admin</h2>
        <p className="text-sm text-slate-600">Tenant-level admin view for projects, tasks, and workspace health.</p>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Projects</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{projectCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tasks</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{taskCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Health</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{health}</p>
        </article>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Notifications</h3>
        <button
          type="button"
          onClick={async () => {
            try {
              setMailStatus("Sending...");
              await sendTestNotification({ subject: "Org admin notification", message: "Notification channel is active." });
              setMailStatus("Test notification sent.");
            } catch (err) {
              setMailStatus(err instanceof Error ? err.message : "Failed to send notification.");
            }
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Send Test Email
        </button>
        {mailStatus ? <p className="mt-2 text-sm text-slate-600">{mailStatus}</p> : null}
      </div>
    </section>
  );
}
