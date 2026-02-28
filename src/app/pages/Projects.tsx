"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createProject, listProjects, listUsers, Project, TenantUser } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

function statusClass(status: string) {
  if (status === "done") return "bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

type ProjectsPageProps = {
  searchQuery?: string;
};

export default function ProjectsPage({ searchQuery = "" }: ProjectsPageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [newStartDate, setNewStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newDurationDays, setNewDurationDays] = useState(30);
  const [newTeamSize, setNewTeamSize] = useState(3);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const [items, tenantUsers] = await Promise.all([listProjects(), listUsers()]);
      setProjects(items);
      setUsers(tenantUsers);
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
      const created = await createProject({
        name: newName.trim(),
        status: newStatus,
        assignees: selectedAssignees,
        start_date: newStartDate,
        duration_days: newDurationDays,
        team_size: newTeamSize,
      });
      setProjects((prev) => [created, ...prev]);
      setNewName("");
      setNewStatus("active");
      setSelectedAssignees([]);
      setNewStartDate(new Date().toISOString().slice(0, 10));
      setNewDurationDays(30);
      setNewTeamSize(3);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    }
  }

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) => `${project.name} ${project.status} ${(project.assignees || []).join(" ")}`.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const summary = useMemo(() => {
    const total = filteredProjects.length;
    const active = filteredProjects.filter((project) => project.status === "active").length;
    const done = filteredProjects.filter((project) => project.status === "done").length;
    return { total, active, done };
  }, [filteredProjects]);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Project Portfolio</h2>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-[1px]"
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
      {loading ? <LoadingSpinner label="Loading projects..." /> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Assignees</th>
                <th className="px-2 py-2 font-medium">Time Frame</th>
                <th className="px-2 py-2 font-medium">Team Size</th>
                <th className="px-2 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-3 font-medium text-slate-900">{project.name}</td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(project.status)}`}>{project.status}</span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{(project.assignees || []).slice(0, 2).join(", ") || "-"}</td>
                  <td className="px-2 py-3 text-slate-700">
                    {project.start_date && project.due_date
                      ? `${new Date(project.start_date).toLocaleDateString()} - ${new Date(project.due_date).toLocaleDateString()} (${project.duration_days} days)`
                      : `${project.duration_days} days`}
                  </td>
                  <td className="px-2 py-3 text-slate-700">{project.team_size}</td>
                  <td className="px-2 py-3 text-slate-700">{new Date(project.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <form onSubmit={onCreate} className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Create Project</h3>
              <p className="mt-1 text-sm text-slate-600">Define timeline, ownership, and staffing in one place.</p>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Project Name</label>
                <input type="text" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Website redesign Q2" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Execution Status</label>
                <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300">
                  <option value="active">active</option>
                  <option value="done">done</option>
                  <option value="blocked">blocked</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assignees</label>
                <select
                  multiple
                  value={selectedAssignees}
                  onChange={(event) => setSelectedAssignees(Array.from(event.target.selectedOptions).map((option) => option.value))}
                  className="h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                >
                  {users.map((user) => (
                    <option key={user.id || user.email} value={user.email}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
                <input type="date" value={newStartDate} onChange={(event) => setNewStartDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Duration (Days)</label>
                <input type="number" min={1} value={newDurationDays} onChange={(event) => setNewDurationDays(Number(event.target.value))} placeholder="30" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assigned People</label>
                <input type="number" min={1} value={newTeamSize} onChange={(event) => setNewTeamSize(Number(event.target.value))} placeholder="3" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" required />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Create Project
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

