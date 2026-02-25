"use client";

import { useEffect, useState } from "react";
import { getSystemAnalytics, getSystemOrganizations, SystemAnalytics, SystemOrganization } from "../auth/auth";

function PieUsage({ active, total }: { active: number; total: number }) {
  const size = 144;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const activeRatio = total > 0 ? Math.min(1, Math.max(0, active / total)) : 0;
  const dash = activeRatio * circumference;
  const quiet = Math.max(0, total - active);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Active Users Split (7d)</h3>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-36 w-36">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="round"
          />
        </svg>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-slate-900">{active} active</p>
          <p className="text-slate-600">{quiet} quiet</p>
          <p className="text-xs text-slate-500">{total} total users</p>
        </div>
      </div>
    </div>
  );
}

function LineUsage({ organizations }: { organizations: SystemOrganization[] }) {
  const top = organizations.slice(0, 8);
  const w = 420;
  const h = 180;
  const pad = 18;
  const maxY = Math.max(1, ...top.map((item) => item.active_users_7d));
  const stepX = top.length > 1 ? (w - pad * 2) / (top.length - 1) : 0;
  const points = top
    .map((item, index) => {
      const x = pad + index * stepX;
      const y = h - pad - (item.active_users_7d / maxY) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Active Users Trend by Top Organizations</h3>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-48 min-w-[420px] w-full">
          <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#cbd5e1" strokeWidth="1.5" />
          <polyline fill="none" stroke="#0ea5e9" strokeWidth="3" points={points} />
          {top.map((item, index) => {
            const x = pad + index * stepX;
            const y = h - pad - (item.active_users_7d / maxY) * (h - pad * 2);
            return <circle key={item.tenant_slug} cx={x} cy={y} r="3.5" fill="#0284c7" />;
          })}
        </svg>
      </div>
      <p className="mt-2 text-xs text-slate-500">Based on active users in the last 7 days.</p>
    </div>
  );
}

export default function DashboardadminPage() {
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [organizations, setOrganizations] = useState<SystemOrganization[]>([]);
  const [error, setError] = useState("");

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
        setError(err instanceof Error ? err.message : "Failed to load analytics dashboard.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">System Analytics Dashboard</h2>
        <p className="text-sm text-slate-600">Cross-tenant activity analytics with charts and detailed usage data.</p>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Organizations</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.tenant_count ?? "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Users (24h)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.active_users_24h ?? "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Users (7d)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.active_users_7d ?? "-"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Orgs (7d)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics?.active_tenants_7d ?? "-"}</p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PieUsage active={analytics?.active_users_7d ?? 0} total={analytics?.user_count ?? 0} />
        <LineUsage organizations={organizations} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Organization Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Tenant</th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Users</th>
                <th className="px-2 py-2 font-medium">Active Users (7d)</th>
                <th className="px-2 py-2 font-medium">Projects</th>
                <th className="px-2 py-2 font-medium">Tasks</th>
                <th className="px-2 py-2 font-medium">Last Login</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.tenant_slug} className="border-b border-slate-100">
                  <td className="px-2 py-3 font-medium text-slate-900">{org.tenant_slug}</td>
                  <td className="px-2 py-3 text-slate-700">{org.tenant_name}</td>
                  <td className="px-2 py-3 text-slate-700">{org.user_count}</td>
                  <td className="px-2 py-3 text-slate-700">{org.active_users_7d}</td>
                  <td className="px-2 py-3 text-slate-700">{org.project_count}</td>
                  <td className="px-2 py-3 text-slate-700">{org.task_count}</td>
                  <td className="px-2 py-3 text-slate-700">{org.last_login_at ? new Date(org.last_login_at).toLocaleString() : "-"}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        org.active_workspace_7d ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {org.active_workspace_7d ? "Active" : "Quiet"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
