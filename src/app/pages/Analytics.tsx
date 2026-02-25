"use client";

import { useEffect, useMemo, useState } from "react";
import { listProjects, Project } from "../auth/auth";

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export default function AnalyticsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const items = await listProjects();
        if (mounted) setProjects(items);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load analytics.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const analytics = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((item) => item.status === "active").length;
    const done = projects.filter((item) => item.status === "done").length;
    const blocked = projects.filter((item) => item.status === "blocked").length;
    return {
      total,
      active,
      done,
      blocked,
      completion: percent(done, total),
      activeRate: percent(active, total),
      blockerRate: percent(blocked, total),
    };
  }, [projects]);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-600">Advanced live metrics based on backend project records.</p>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-600">Calculating analytics...</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Projects</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.total}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Completion Rate</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{analytics.completion}%</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Rate</p>
          <p className="mt-2 text-2xl font-semibold text-sky-700">{analytics.activeRate}%</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Blocker Rate</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{analytics.blockerRate}%</p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Status Distribution</h3>
          <div className="space-y-3">
            {[
              { label: "Done", value: analytics.done, color: "bg-emerald-500" },
              { label: "Active", value: analytics.active, color: "bg-sky-500" },
              { label: "Blocked", value: analytics.blocked, color: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${percent(item.value, analytics.total)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Insights</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="rounded-lg bg-slate-50 px-3 py-2">Projects completed: {analytics.done}</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Projects in execution: {analytics.active}</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Blocked pipelines: {analytics.blocked}</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
