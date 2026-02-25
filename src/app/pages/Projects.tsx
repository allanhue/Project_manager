"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createProject, listProjects, Project } from "../auth/auth";

function statusClass(status: string) {
  if (status === "done") return "bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("active");

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const items = await listProjects();
      setProjects(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    setError("");
    try {
      const created = await createProject({ name: newName.trim(), status: newStatus });
      setProjects((prev) => [created, ...prev]);
      setNewName("");
      setNewStatus("active");
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    }
  }

  const summary = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((project) => project.status === "active").length;
    const done = projects.filter((project) => project.status === "done").length;
    return { total, active, done };
  }, [projects]);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Project Portfolio</h2>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            New Project
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-2xl font-semibold text-slate-900">{summary.total}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active</p>
          <p className="text-2xl font-semibold text-slate-900">{summary.active}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Done</p>
          <p className="text-2xl font-semibold text-slate-900">{summary.done}</p>
        </article>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-600">Loading projects...</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-slate-100">
                  <td className="px-2 py-3 font-medium text-slate-900">{project.name}</td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(project.status)}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{new Date(project.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={onCreate} className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Create Project</h3>
            <p className="mt-1 text-sm text-slate-600">Capture client work, billing stage and delivery status quickly.</p>
            <div className="mt-4 grid gap-3">
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Project name"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
              <select
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
              >
                <option value="active">active</option>
                <option value="done">done</option>
                <option value="blocked">blocked</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Create
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
