"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { listProjects, listTasks, sendSupportRequest, sendTestNotification } from "../auth/auth";

export default function TenantAdminPage() {
  const [projectCount, setProjectCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [error, setError] = useState("");
  const [mailStatus, setMailStatus] = useState("");
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState("");

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

  async function onSupportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupportStatus("");
    try {
      await sendSupportRequest({ subject, priority, message });
      setSupportStatus("Support request sent.");
      setSubject("");
      setPriority("normal");
      setMessage("");
      setShowSupportModal(false);
    } catch (err) {
      setSupportStatus(err instanceof Error ? err.message : "Failed to send support request.");
    }
  }

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
        <div className="flex flex-wrap gap-2">
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
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Send Test Email
          </button>
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Open Support Mailbox
          </button>
        </div>
        {mailStatus ? <p className="mt-2 text-sm text-slate-600">{mailStatus}</p> : null}
        {supportStatus ? <p className="mt-2 text-sm text-slate-600">{supportStatus}</p> : null}
      </div>

      {showSupportModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={onSupportSubmit} className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Support Request</h3>
            <p className="mt-1 text-sm text-slate-600">Submit an issue for the system-admin support queue.</p>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  placeholder="Example: Invoice sync failure"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                >
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                <textarea
                  required
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  placeholder="Describe what is happening, expected result, and affected users."
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Submit Request
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
