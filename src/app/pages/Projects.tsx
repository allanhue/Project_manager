"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createProject, IssueItem, listIssues, listProjects, listTasks, listUsers, Project, TaskItem, TenantUser, updateProject } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

function statusClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "done" || normalized === "completed" || normalized === "closed") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (normalized === "blocked") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
}

function statusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "done" || normalized === "completed" || normalized === "closed") return "Done";
  if (normalized === "blocked") return "Blocked";
  if (normalized === "in progress") return "In Progress";
  if (normalized === "todo") return "To Do";
  if (normalized === "active") return "Active";
  return status;
}

type ProjectsPageProps = {
  searchQuery?: string;
};

export default function ProjectsPage({ searchQuery = "" }: ProjectsPageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProjectCode, setNewProjectCode] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [newStartDate, setNewStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newDurationDays, setNewDurationDays] = useState(30);
  const [newTeamSize, setNewTeamSize] = useState(3);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedReportProjectID, setSelectedReportProjectID] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const [items, tenantUsers, taskItems, issueItems] = await Promise.all([listProjects(), listUsers(), listTasks(), listIssues()]);
      setProjects(items);
      setUsers(tenantUsers);
      setTasks(taskItems);
      setIssues(issueItems);
      if (items.length > 0 && selectedReportProjectID === "") setSelectedReportProjectID(items[0].id);
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
    if (!newName.trim() || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const created = await createProject({
        project_code: newProjectCode.trim(),
        name: newName.trim(),
        status: newStatus,
        assignees: selectedAssignees,
        start_date: newStartDate,
        duration_days: newDurationDays,
        team_size: newTeamSize,
      });
      setProjects((prev) => [created, ...prev]);
      setNewName("");
      setNewProjectCode("");
      setNewStatus("active");
      setSelectedAssignees([]);
      setNewStartDate(new Date().toISOString().slice(0, 10));
      setNewDurationDays(30);
      setNewTeamSize(3);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  }

  function openCreate() {
    setEditingProject(null);
    setNewName("");
    setNewProjectCode("");
    setNewStatus("active");
    setSelectedAssignees([]);
    setNewStartDate(new Date().toISOString().slice(0, 10));
    setNewDurationDays(30);
    setNewTeamSize(3);
    setShowCreate(true);
  }

  function closeForm() {
    if (submitting) return;
    setShowCreate(false);
    setEditingProject(null);
  }

  async function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProject || !newName.trim() || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const updated = await updateProject({
        id: editingProject.id,
        project_code: newProjectCode.trim(),
        name: newName.trim(),
        status: newStatus,
        assignees: selectedAssignees,
        start_date: newStartDate,
        duration_days: newDurationDays,
        team_size: newTeamSize,
      });
      setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingProject(null);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setNewName(project.name);
    setNewProjectCode(project.project_code || "");
    setNewStatus(project.status || "active");
    setSelectedAssignees(project.assignees || []);
    setNewStartDate(project.start_date ? new Date(project.start_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setNewDurationDays(project.duration_days || 30);
    setNewTeamSize(project.team_size || 1);
    setShowCreate(true);
  }

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) => `${project.name} ${project.status} ${(project.assignees || []).join(" ")}`.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const summary = useMemo(() => {
    const total = filteredProjects.length;
    const active = filteredProjects.filter((project) => {
      const normalized = project.status.trim().toLowerCase();
      return normalized !== "done" && normalized !== "completed" && normalized !== "closed";
    }).length;
    const done = filteredProjects.filter((project) => {
      const normalized = project.status.trim().toLowerCase();
      return normalized === "done" || normalized === "completed" || normalized === "closed";
    }).length;
    return { total, active, done };
  }, [filteredProjects]);

  const selectedReportProject = useMemo(
    () => projects.find((item) => item.id === selectedReportProjectID) || null,
    [projects, selectedReportProjectID],
  );
  const selectedProjectTasks = useMemo(
    () => (selectedReportProject ? tasks.filter((item) => item.project_id === selectedReportProject.id) : []),
    [selectedReportProject, tasks],
  );
  const selectedProjectIssues = useMemo(
    () => (selectedReportProject ? issues.filter((item) => item.project_id === selectedReportProject.id) : []),
    [selectedReportProject, issues],
  );
  const selectedDoneTasks = selectedProjectTasks.filter((item) => {
    const s = item.status.trim().toLowerCase();
    return s === "done" || s === "completed" || s === "closed";
  }).length;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Project Portfolio</h2>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-[1px]"
          >
            New Project
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Project Mini Report</h3>
            <p className="text-xs text-slate-600">Choose a project to view tasks and issues raised for the same project.</p>
          </div>
          <select
            value={String(selectedReportProjectID)}
            onChange={(event) => setSelectedReportProjectID(event.target.value ? Number(event.target.value) : "")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        {selectedReportProject ? (
          <>
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-slate-500">Tasks</p><p className="text-lg font-semibold text-slate-900">{selectedProjectTasks.length}</p></article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-slate-500">Done Tasks</p><p className="text-lg font-semibold text-emerald-700">{selectedDoneTasks}</p></article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-slate-500">Issues Raised</p><p className="text-lg font-semibold text-amber-700">{selectedProjectIssues.length}</p></article>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Title</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Priority / Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProjectTasks.slice(0, 6).map((item) => (
                    <tr key={`task-mini-${item.id}`} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-slate-700">Task</td>
                      <td className="px-2 py-2 text-slate-900">{item.title}</td>
                      <td className="px-2 py-2 text-slate-700">{item.status}</td>
                      <td className="px-2 py-2 text-slate-700">{item.priority}</td>
                    </tr>
                  ))}
                  {selectedProjectIssues.slice(0, 6).map((item) => (
                    <tr key={`issue-mini-${item.id}`} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-slate-700">Issue</td>
                      <td className="px-2 py-2 text-slate-900">{item.title}</td>
                      <td className="px-2 py-2 text-slate-700">{item.status}</td>
                      <td className="px-2 py-2 text-slate-700">{item.severity}</td>
                    </tr>
                  ))}
                  {selectedProjectTasks.length === 0 && selectedProjectIssues.length === 0 ? (
                    <tr>
                      <td className="px-2 py-2 text-slate-500" colSpan={4}>
                        No tasks or issues found for this project.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Choose a project to display its mini report.</p>
        )}
      </section>

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
                <th className="px-2 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-3 font-medium text-slate-900">{project.name}</td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusClass(project.status)}`}>{statusLabel(project.status)}</span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{(project.assignees || []).slice(0, 2).join(", ") || "-"}</td>
                  <td className="px-2 py-3 text-slate-700">
                    {project.start_date && project.due_date
                      ? `${new Date(project.start_date).toLocaleDateString()} - ${new Date(project.due_date).toLocaleDateString()} (${project.duration_days} days)`
                      : `${project.duration_days} days`}
                  </td>
                  <td className="px-2 py-3 text-slate-700">{project.team_size}</td>
                  <td className="px-2 py-3 text-slate-700">{new Date(project.created_at).toLocaleString()}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openEdit(project)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedReportProjectID(project.id)}
                        className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                      >
                        Report
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <form onSubmit={editingProject ? onUpdate : onCreate} className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingProject ? "Edit Project" : "Create Project"}</h3>
              <p className="mt-1 text-sm text-slate-600">{editingProject ? "Update timeline, ownership, and staffing details." : "Define timeline, ownership, and staffing in one place."}</p>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Project Name</label>
                <input type="text" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Website redesign Q2" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project ID (Internal)</label>
                <input
                  type="text"
                  value={newProjectCode}
                  onChange={(event) => setNewProjectCode(event.target.value)}
                  placeholder="PRJ-001"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Execution Status</label>
                <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-sky-300">
                  <option value="active">Active</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
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
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : null}
                {submitting ? (editingProject ? "Saving..." : "Creating...") : editingProject ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
