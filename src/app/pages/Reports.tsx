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

  const reportRows = useMemo(() => {
    return filteredProjects
      .filter((project) => selectedProjectID === "all" || project.id === selectedProjectID)
      .map((project) => {
        const pTasks = tasks.filter((item) => item.project_id === project.id);
        const pDone = pTasks.filter((item) => {
          const s = item.status.trim().toLowerCase();
          return s === "done" || s === "completed" || s === "closed";
        }).length;
        const pIssues = issues.filter((item) => item.project_id === project.id);
        const pOpenIssues = pIssues.filter((item) => item.status.trim().toLowerCase() !== "closed").length;
        return {
          project_id: project.id,
          project_code: project.project_code || "",
          generated_at: new Date().toISOString(),
          project_name: project.name,
          project_status: project.status,
          task_total: pTasks.length,
          task_done: pDone,
          task_open: pTasks.length - pDone,
          issue_total: pIssues.length,
          issue_open: pOpenIssues,
          task_ids: pTasks.map((task) => task.task_code || String(task.id)).join("; "),
        };
      });
  }, [filteredProjects, issues, selectedProjectID, tasks]);

  function exportCSV() {
    const headers = ["Generated At", "Project ID", "Project", "Status", "Task IDs", "Total Tasks", "Done Tasks", "Open Tasks", "Total Issues", "Open Issues"];
    const lines = [
      headers.join(","),
      ...reportRows.map((row) =>
        [
          row.generated_at,
          row.project_code,
          row.project_name,
          row.project_status,
          row.task_ids,
          row.task_total,
          row.task_done,
          row.task_open,
          row.issue_total,
          row.issue_open,
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pulseforge-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportExcelCompatible() {
    const tableRows = reportRows
      .map(
        (row) => `
      <tr>
        <td>${row.generated_at}</td>
        <td>${row.project_code}</td>
        <td>${row.project_name}</td>
        <td>${row.project_status}</td>
        <td>${row.task_ids}</td>
        <td>${row.task_total}</td>
        <td>${row.task_done}</td>
        <td>${row.task_open}</td>
        <td>${row.issue_total}</td>
        <td>${row.issue_open}</td>
      </tr>`,
      )
      .join("");
    const html = `
      <html><head><meta charset="utf-8" /></head><body>
        <table border="1">
          <tr>
            <th>Generated At</th>
            <th>Project ID</th>
            <th>Project</th>
            <th>Status</th>
            <th>Task IDs</th>
            <th>Total Tasks</th>
            <th>Done Tasks</th>
            <th>Open Tasks</th>
            <th>Total Issues</th>
            <th>Open Issues</th>
          </tr>
          ${tableRows}
        </table>
      </body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pulseforge-report-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
            <p className="text-sm text-slate-600">Organization performance view by project, task completion, and issue pressure.</p>
          </div>
          <div className="flex items-center gap-2">
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
            <button type="button" onClick={exportCSV} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              Export CSV
            </button>
            <button type="button" onClick={exportExcelCompatible} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
              Export XLS
            </button>
          </div>
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
              {reportRows.map((row) => (
                <tr key={row.project_id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-900">{row.project_name}</td>
                  <td className="px-2 py-2 text-slate-700">{row.project_status}</td>
                  <td className="px-2 py-2 text-slate-700">{row.task_total}</td>
                  <td className="px-2 py-2 text-emerald-700">{row.task_done}</td>
                  <td className="px-2 py-2 text-rose-700">{row.task_open}</td>
                  <td className="px-2 py-2 text-slate-700">{row.issue_total}</td>
                  <td className="px-2 py-2 text-amber-700">{row.issue_open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
