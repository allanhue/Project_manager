"use client";

import { useEffect, useState } from "react";
import { getSystemAnalytics, getSystemOrganizations, sendTestNotification, SystemAnalytics, SystemOrganization } from "../auth/auth";

export default function SystemAdminHome() {
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [organizations, setOrganizations] = useState<SystemOrganization[]>([]);
  const [error, setError] = useState("");
  const [mailStatus, setMailStatus] = useState("");

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
          onClick={async () => {
            try {
              setMailStatus("Sending...");
              await sendTestNotification({ subject: "System admin monitor", message: "System admin notification channel is active." });
              setMailStatus("System notification sent.");
            } catch (err) {
              setMailStatus(err instanceof Error ? err.message : "Failed to send system notification.");
            }
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Send System Test Email
        </button>
        {mailStatus ? <p className="mt-2 text-sm text-slate-600">{mailStatus}</p> : null}
      </div>
    </section>
  );
}
