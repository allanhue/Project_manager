"use client";

import { useEffect, useMemo, useState } from "react";
import { IssueItem, listIssues, listProjects, listTasks, Project, TaskItem } from "../auth/auth";

type ReportsPageProps = {
  searchQuery?: string;
};

export default function ReportsPage({ searchQuery = "" }: ReportsPageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [selectedProjectID, setSelectedProjectID] = useState<number | "all">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [projectItems, taskItems, issueItems] = await Promise.all([listProjects(), listTasks(), listIssues()]);
        if (!mounted) return;
        setProjects(projectItems);
        setTasks(taskItems);
        setIssues(issueItems);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load reports.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((item) => `${item.name} ${item.status} ${(item.assignees || []).join(" ")}`.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const scopedProjectIDs = useMemo(() => {
    if (selectedProjectID === "all") return new Set(filteredProjects.map((item) => item.id));
    return new Set([selectedProjectID]);
  }, [filteredProjects, selectedProjectID]);

  const scopedTasks = useMemo(() => tasks.filter((item) => scopedProjectIDs.has(item.project_id)), [tasks, scopedProjectIDs]);
  const scopedIssues = useMemo(() => issues.filter((item) => (item.project_id ? scopedProjectIDs.has(item.project_id) : selectedProjectID === "all")), [issues, scopedProjectIDs, selectedProjectID]);

  const doneTasks = scopedTasks.filter((item) => {
    const s = item.status.trim().toLowerCase();
    return s === "done" || s === "completed" || s === "closed";
  }).length;
  const openTasks = scopedTasks.length - doneTasks;
  const openIssues = scopedIssues.filter((item) => item.status.trim().toLowerCase() !== "closed").length;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
            <p className="text-sm text-slate-600">Organization performance view by project, task completion, and issue pressure.</p>
          </div>
          <select
            value={String(selectedProjectID)}
            onChange={(event) => setSelectedProjectID(event.target.value === "all" ? "all" : Number(event.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            <option value="all">All Projects</option>
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Projects</p><p className="mt-2 text-2xl font-semibold text-slate-900">{selectedProjectID === "all" ? filteredProjects.length : 1}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Tasks</p><p className="mt-2 text-2xl font-semibold text-slate-900">{scopedTasks.length}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Open Tasks</p><p className="mt-2 text-2xl font-semibold text-rose-700">{openTasks}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Open Issues</p><p className="mt-2 text-2xl font-semibold text-amber-700">{openIssues}</p></article>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Project Report Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Tasks</th>
                <th className="px-2 py-2 font-medium">Done</th>
                <th className="px-2 py-2 font-medium">Open</th>
                <th className="px-2 py-2 font-medium">Issues</th>
                <th className="px-2 py-2 font-medium">Open Issues</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects
                .filter((project) => selectedProjectID === "all" || project.id === selectedProjectID)
                .map((project) => {
                  const pTasks = tasks.filter((item) => item.project_id === project.id);
                  const pDone = pTasks.filter((item) => {
                    const s = item.status.trim().toLowerCase();
                    return s === "done" || s === "completed" || s === "closed";
                  }).length;
                  const pIssues = issues.filter((item) => item.project_id === project.id);
                  const pOpenIssues = pIssues.filter((item) => item.status.trim().toLowerCase() !== "closed").length;
                  return (
                    <tr key={project.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-medium text-slate-900">{project.name}</td>
                      <td className="px-2 py-2 text-slate-700">{project.status}</td>
                      <td className="px-2 py-2 text-slate-700">{pTasks.length}</td>
                      <td className="px-2 py-2 text-emerald-700">{pDone}</td>
                      <td className="px-2 py-2 text-rose-700">{pTasks.length - pDone}</td>
                      <td className="px-2 py-2 text-slate-700">{pIssues.length}</td>
                      <td className="px-2 py-2 text-amber-700">{pOpenIssues}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

