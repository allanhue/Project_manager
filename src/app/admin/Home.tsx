"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSystemAnalytics, getSystemOrganizations, sendTestNotification, SystemAnalytics, SystemOrganization } from "../auth/auth";

export default function SystemAdminHome() {
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [organizations, setOrganizations] = useState<SystemOrganization[]>([]);
  const [error, setError] = useState("");
  const [mailStatus, setMailStatus] = useState("");
  const [showMailModal, setShowMailModal] = useState(false);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("System support notification");
  const [message, setMessage] = useState("Hello, this is a support notification from system administration.");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [a, orgs] = await Promise.all([getSystemAnalytics(), getSystemOrganizations()]);
        if (!mounted) return;
        setAnalytics(a);
        setOrganizations(orgs);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load system-admin data.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setMailStatus("Sending...");
      await sendTestNotification({ email, subject, message });
      setMailStatus("System notification sent.");
      setShowMailModal(false);
    } catch (err) {
      setMailStatus(err instanceof Error ? err.message : "Failed to send system notification.");
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">System Administrator</h2>
        <p className="text-sm text-slate-600">Cross-tenant monitoring for organizations, usage and operations.</p>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Organizations</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.tenant_count ?? "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Users</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.user_count ?? "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Projects</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.project_count ?? "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tasks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.task_count ?? "-"}</p>
        </article>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Organization Usage</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Tenant</th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Users</th>
                <th className="px-2 py-2 font-medium">Projects</th>
                <th className="px-2 py-2 font-medium">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.tenant_slug} className="border-b border-slate-100">
                  <td className="px-2 py-3 font-medium text-slate-900">{org.tenant_slug}</td>
                  <td className="px-2 py-3 text-slate-700">{org.tenant_name}</td>
                  <td className="px-2 py-3 text-slate-700">{org.user_count}</td>
                  <td className="px-2 py-3 text-slate-700">{org.project_count}</td>
                  <td className="px-2 py-3 text-slate-700">{org.task_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">System Notifications</h3>
        <button
          type="button"
          onClick={() => setShowMailModal(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Compose Support Email
        </button>
        {mailStatus ? <p className="mt-2 text-sm text-slate-600">{mailStatus}</p> : null}
      </div>

      {showMailModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={onSend} className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Send Support Email</h3>
            <p className="mt-1 text-sm text-slate-600">Send a direct support notification to an organization administrator.</p>
            <div className="mt-4 grid gap-3">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Recipient email (optional)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
              <input
                type="text"
                required
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
              <textarea
                required
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Message body"
                className="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMailModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
