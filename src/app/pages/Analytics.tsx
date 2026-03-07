"use client";

import { useEffect, useMemo, useState } from "react";
import { listProjects, Project } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isDoneStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "done" || normalized === "completed" || normalized === "closed";
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

type AnalyticsPageProps = {
  searchQuery?: string;
};

export default function AnalyticsPage({ searchQuery = "" }: AnalyticsPageProps) {
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

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) => `${project.name} ${project.status} ${(project.assignees || []).join(" ")}`.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const analytics = useMemo(() => {
    const total = filteredProjects.length;
    const active = filteredProjects.filter((item) => item.status === "active").length;
    const done = filteredProjects.filter((item) => item.status === "done").length;
    const blocked = filteredProjects.filter((item) => item.status === "blocked").length;
    const contributorCounts = new Map<string, number>();
    filteredProjects.forEach((project) => {
      (project.assignees || []).forEach((assignee) => contributorCounts.set(assignee, (contributorCounts.get(assignee) || 0) + 1));
    });
    const logs = Array.from(contributorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([user, count]) => ({ user, count }));
    return {
      total,
      active,
      done,
      blocked,
      completion: percent(done, total),
      activeRate: percent(active, total),
      blockerRate: percent(blocked, total),
      logs,
    };
  }, [filteredProjects]);

  const pieTotal = Math.max(1, analytics.total);
  const doneDeg = (analytics.done / pieTotal) * 360;
  const activeDeg = (analytics.active / pieTotal) * 360;
  const blockedDeg = (analytics.blocked / pieTotal) * 360;

  const deliveryTrend = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }

    const totalsByMonth = new Map<string, number>();
    const doneByMonth = new Map<string, number>();
    months.forEach((key) => {
      totalsByMonth.set(key, 0);
      doneByMonth.set(key, 0);
    });

    filteredProjects.forEach((project) => {
      const created = new Date(project.created_at);
      if (Number.isNaN(created.getTime())) return;
      const key = monthKey(new Date(created.getFullYear(), created.getMonth(), 1));
      if (!totalsByMonth.has(key)) return;
      totalsByMonth.set(key, (totalsByMonth.get(key) || 0) + 1);
      if (isDoneStatus(project.status)) {
        doneByMonth.set(key, (doneByMonth.get(key) || 0) + 1);
      }
    });

    return months.map((key) => {
      const total = totalsByMonth.get(key) || 0;
      const done = doneByMonth.get(key) || 0;
      return {
        key,
        label: monthLabel(key),
        total,
        done,
        rate: percent(done, total),
      };
    });
  }, [filteredProjects]);

  const chartWidth = 620;
  const chartHeight = 220;
  const chartPad = 28;
  const stepX = deliveryTrend.length > 1 ? (chartWidth - chartPad * 2) / (deliveryTrend.length - 1) : 0;
  const trendPoints = deliveryTrend
    .map((point, index) => {
      const x = chartPad + index * stepX;
      const y = chartHeight - chartPad - (point.rate / 100) * (chartHeight - chartPad * 2);
      return { x, y, ...point };
    });
  const polylinePoints = trendPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Finance and Delivery Analytics</h2>
        <p className="text-sm text-slate-600">Track performance, execution health and operational trends in one view.</p>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <LoadingSpinner label="Calculating analytics..." /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Engagements</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.total}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Completion Ratio</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{analytics.completion}%</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Execution Ratio</p>
          <p className="mt-2 text-2xl font-semibold text-sky-700">{analytics.activeRate}%</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Risk Ratio</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{analytics.blockerRate}%</p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Project Status</h3>
          <div className="flex items-center gap-6">
            <div
              className="h-40 w-40 rounded-full"
              style={{
                background: `conic-gradient(#10b981 0deg ${doneDeg}deg, #0ea5e9 ${doneDeg}deg ${doneDeg + activeDeg}deg, #f59e0b ${doneDeg + activeDeg}deg ${doneDeg + activeDeg + blockedDeg}deg, #e2e8f0 0deg)`,
              }}
            />
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Done: {analytics.done}
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" /> Active: {analytics.active}
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Blocked: {analytics.blocked}
              </li>
            </ul>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Execution Bar Chart</h3>
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
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Project Delivery Trend</h3>
        <p className="mb-4 text-xs text-slate-500">Monthly completion rate (done vs created projects) for the last 6 months.</p>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[620px] w-full">
            <line x1={chartPad} y1={chartPad} x2={chartPad} y2={chartHeight - chartPad} stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1={chartPad} y1={chartHeight - chartPad} x2={chartWidth - chartPad} y2={chartHeight - chartPad} stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1={chartPad} y1={chartPad} x2={chartWidth - chartPad} y2={chartPad} stroke="#f1f5f9" strokeWidth="1" />
            <line x1={chartPad} y1={(chartPad + chartHeight - chartPad) / 2} x2={chartWidth - chartPad} y2={(chartPad + chartHeight - chartPad) / 2} stroke="#f1f5f9" strokeWidth="1" />
            <polyline fill="none" stroke="#0ea5e9" strokeWidth="3" points={polylinePoints} />
            {trendPoints.map((point) => (
              <g key={point.key}>
                <circle cx={point.x} cy={point.y} r="4" fill="#0284c7" />
                <text x={point.x} y={chartHeight - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {point.label}
                </text>
                <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-slate-700 text-[10px]">
                  {point.rate}%
                </text>
              </g>
            ))}
          </svg>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">User Logs Working on Projects</h3>
        <ul className="space-y-2 text-sm text-slate-700">
          {analytics.logs.length === 0 ? <li className="rounded-lg bg-slate-50 px-3 py-2">No assignee activity yet.</li> : null}
          {analytics.logs.map((entry) => (
            <li key={entry.user} className="rounded-lg bg-slate-50 px-3 py-2">
              {entry.user}: assigned to {entry.count} project(s)
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
