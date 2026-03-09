"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createProject, deleteProject, IssueItem, listIssues, listProjects, listTasks, listUsers, Project, TaskItem, TenantUser, updateProject } from "../auth/auth";
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

function splitAssigneeInput(raw: string): string[] {
  return raw
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
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
  const [newAssigneeInput, setNewAssigneeInput] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [openMenuProjectId, setOpenMenuProjectId] = useState<number | null>(null);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const [projectAttachments, setProjectAttachments] = useState<File[]>([]);
  const [selectedReportProjectID, setSelectedReportProjectID] = useState<number | "">("");
  const [isMiniReportOpen, setIsMiniReportOpen] = useState(true);

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const [items, tenantUsers, taskItems, issueItems] = await Promise.all([listProjects(), listUsers(), listTasks(), listIssues()]);
      setProjects(items);
      setUsers(tenantUsers);
      setTasks(taskItems);
      setIssues(issueItems);
      if (items.length > 0 && selectedReportProjectID === "") {
        setSelectedReportProjectID(items[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (openMenuProjectId === null) return undefined;
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-project-menu]")) return;
      setOpenMenuProjectId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenuProjectId]);

  useEffect(() => {
    if (!isBulkMenuOpen) return undefined;
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-project-bulk-menu]")) return;
      setIsBulkMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isBulkMenuOpen]);

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
        attachments: projectAttachments.map((file) => file.name),
      });
      setProjects((prev) => [...prev, created]);
      setNewName("");
      setNewProjectCode("");
      setNewStatus("active");
      setSelectedAssignees([]);
      setNewAssigneeInput("");
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
    setNewAssigneeInput("");
    setNewStartDate(new Date().toISOString().slice(0, 10));
    setNewDurationDays(30);
    setNewTeamSize(3);
    setProjectAttachments([]);
    setShowCreate(true);
  }

  function closeForm() {
    if (submitting) return;
    setShowCreate(false);
    setEditingProject(null);
  }

  async function onBulkDelete() {
    if (selectedProjects.length === 0) return;
    if (!window.confirm(`Delete ${selectedProjects.length} selected project(s)? This will also remove their tasks.`)) return;
    setError("");
    try {
      for (const id of selectedProjects) {
        await deleteProject(id);
      }
      setProjects((prev) => prev.filter((project) => !selectedProjects.includes(project.id)));
      setTasks((prev) => prev.filter((task) => !selectedProjects.includes(task.project_id)));
      setSelectedProjects([]);
      setIsSelectionMode(false);
      if (selectedReportProjectID && selectedProjects.includes(Number(selectedReportProjectID))) {
        setSelectedReportProjectID("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete projects.");
    }
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
        attachments: projectAttachments.map((file) => file.name),
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
    setOpenMenuProjectId(null);
    setEditingProject(project);
    setNewName(project.name);
    setNewProjectCode(project.project_code || "");
    setNewStatus(project.status || "active");
    setSelectedAssignees(project.assignees || []);
    setNewAssigneeInput("");
    setNewStartDate(project.start_date ? new Date(project.start_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setNewDurationDays(project.duration_days || 30);
    setNewTeamSize(project.team_size || 1);
    setShowCreate(true);
  }

  async function onDelete(project: Project) {
    if (deletingProjectId !== null) return;
    setOpenMenuProjectId(null);
    if (!window.confirm(`Delete "${project.name}"? This will also remove its tasks.`)) return;
    setError("");
    setDeletingProjectId(project.id);
    try {
      await deleteProject(project.id);
      setProjects((prev) => prev.filter((item) => item.id !== project.id));
      setTasks((prev) => prev.filter((item) => item.project_id !== project.id));
      if (selectedReportProjectID === project.id) {
        setSelectedReportProjectID("");
      }
      if (editingProject?.id === project.id) closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project.");
    } finally {
      setDeletingProjectId(null);
    }
  }

  function addAssigneesFromInput(raw: string) {
    const entries = splitAssigneeInput(raw);
    if (entries.length === 0) return;
    setSelectedAssignees((prev) => {
      const dedup = new Set(prev.map((item) => item.toLowerCase()));
      const next = [...prev];
      entries.forEach((entry) => {
        const key = entry.toLowerCase();
        if (dedup.has(key)) return;
        dedup.add(key);
        next.push(entry);
      });
      return next;
    });
  }

  function removeAssignee(index: number) {
    setSelectedAssignees((prev) => prev.filter((_, i) => i !== index));
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-px"
            >
              New Project
            </button>
            <div className="relative" data-project-bulk-menu>
              <button
                type="button"
                onClick={() => setIsBulkMenuOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                aria-label="Open bulk actions"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              {isBulkMenuOpen ? (
                <div className="absolute right-0 top-11 z-10 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  {!isSelectionMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjects([]);
                        setIsSelectionMode(true);
                        setIsBulkMenuOpen(false);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                    >
                      Select Delete
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjects(filteredProjects.map((p) => p.id));
                          setIsBulkMenuOpen(false);
                        }}
                        disabled={filteredProjects.length === 0 || selectedProjects.length === filteredProjects.length}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjects([]);
                          setIsBulkMenuOpen(false);
                        }}
                        disabled={selectedProjects.length === 0}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Clear selection
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsBulkMenuOpen(false);
                          void onBulkDelete();
                        }}
                        disabled={selectedProjects.length === 0}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete selected{selectedProjects.length ? ` (${selectedProjects.length})` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedProjects([]);
                          setIsBulkMenuOpen(false);
                        }}
                        className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100"
                      >
                        Exit selection mode
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-linear-to-br from-white to-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Project Mini Report</h3>
            <p className="text-xs text-slate-600">Choose a project to view tasks and issues raised for the same project.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsMiniReportOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
          >
            {isMiniReportOpen ? "Collapse" : "Expand"}
            <span
              className={`inline-block text-sm leading-none transition-transform duration-300 ${isMiniReportOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ^
            </span>
          </button>
        </div>

        <div className={`grid transition-all duration-300 ease-out ${isMiniReportOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden px-4 py-4">
            <div className="mb-3">
              <label
                htmlFor="mini-report-project"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Project
              </label>
              <select
                id="mini-report-project"
                value={String(selectedReportProjectID)}
                onChange={(event) => setSelectedReportProjectID(event.target.value ? Number(event.target.value) : "")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 sm:max-w-sm"
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
                  <article className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Tasks</p>
                    <p className="text-lg font-semibold text-slate-900">{selectedProjectTasks.length}</p>
                  </article>
                  <article className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Done Tasks</p>
                    <p className="text-lg font-semibold text-emerald-700">{selectedDoneTasks}</p>
                  </article>
                  <article className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Issues Raised</p>
                    <p className="text-lg font-semibold text-amber-700">{selectedProjectIssues.length}</p>
                  </article>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="px-2 py-2 font-medium">Type</th>
                        <th className="px-2 py-2 font-medium">Title</th>
                        <th className="px-2 py-2 font-medium">Phase</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Priority / Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProjectTasks.slice(0, 6).map((item) => (
                        <tr key={`task-mini-${item.id}`} className="border-b border-slate-100">
                          <td className="px-2 py-2 text-slate-700">Task</td>
                          <td className="px-2 py-2 text-slate-900">{item.title}</td>
                          <td className="px-2 py-2 text-slate-700">{item.phase || "-"}</td>
                          <td className="px-2 py-2 text-slate-700">{item.status}</td>
                          <td className="px-2 py-2 text-slate-700">{item.priority}</td>
                        </tr>
                      ))}
                      {selectedProjectIssues.slice(0, 6).map((item) => (
                        <tr key={`issue-mini-${item.id}`} className="border-b border-slate-100">
                          <td className="px-2 py-2 text-slate-700">Issue</td>
                          <td className="px-2 py-2 text-slate-900">{item.title}</td>
                          <td className="px-2 py-2 text-slate-700">-</td>
                          <td className="px-2 py-2 text-slate-700">{item.status}</td>
                          <td className="px-2 py-2 text-slate-700">{item.severity}</td>
                        </tr>
                      ))}
                      {selectedProjectTasks.length === 0 && selectedProjectIssues.length === 0 ? (
                        <tr>
                          <td className="px-2 py-2 text-slate-500" colSpan={5}>
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
          </div>
        </div>
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
        <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
              {isSelectionMode ? (
                <th className="px-2 py-2 font-medium">
                  <input
                    type="checkbox"
                    checked={selectedProjects.length === filteredProjects.length && filteredProjects.length > 0}
                    aria-label="Select all projects"
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedProjects(filteredProjects.map((p) => p.id));
                      } else {
                        setSelectedProjects([]);
                      }
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                </th>
              ) : null}
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
                  {isSelectionMode ? (
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project.id)}
                        aria-label={`Select project ${project.name}`}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedProjects((prev) => [...prev, project.id]);
                          } else {
                            setSelectedProjects((prev) => prev.filter((id) => id !== project.id));
                          }
                        }}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                    </td>
                  ) : null}
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
                    <div className="relative flex justify-end" data-project-menu>
                      <button
                        type="button"
                        onClick={() => setOpenMenuProjectId((prev) => (prev === project.id ? null : project.id))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                        aria-label={`Open actions for ${project.name}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                      {openMenuProjectId === project.id ? (
                        <div className="absolute right-0 top-11 z-10 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => openEdit(project)}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDelete(project)}
                            disabled={deletingProjectId === project.id}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingProjectId === project.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <form onSubmit={editingProject ? onUpdate : onCreate} className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingProject ? "Edit Project" : "Create Project"}</h3>
              <p className="mt-1 text-sm text-slate-600">{editingProject ? "Update timeline, ownership and staffing details." : "Define timeline, ownership and staffing in one place."}</p>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="project-name" className="mb-1 block text-sm font-medium text-slate-700">
                  Project Name
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Website redesign Q2"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                />
              </div>
              <div>
                <label htmlFor="project-code" className="mb-1 block text-sm font-medium text-slate-700">
                  Project ID (Internal)
                </label>
                <input
                  id="project-code"
                  type="text"
                  value={newProjectCode}
                  onChange={(event) => setNewProjectCode(event.target.value)}
                  placeholder="PRJ-001"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label htmlFor="project-status" className="mb-1 block text-sm font-medium text-slate-700">
                  Execution Status
                </label>
                <select
                  id="project-status"
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-sky-300"
                >
                  <option value="active">Active</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assignees</label>
                <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedAssignees.length > 0 ? (
                      selectedAssignees.map((assignee, index) => (
                        <span key={`${assignee}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                          {assignee}
                          <button
                            type="button"
                            onClick={() => removeAssignee(index)}
                            className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                            aria-label={`Remove ${assignee}`}
                          >
                            x
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No assignees yet.</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="project-assignees"
                      type="text"
                      value={newAssigneeInput}
                      onChange={(event) => setNewAssigneeInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addAssigneesFromInput(newAssigneeInput);
                          setNewAssigneeInput("");
                        }
                      }}
                      list="project-assignee-options"
                      placeholder="Type name or email"
                      className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addAssigneesFromInput(newAssigneeInput);
                        setNewAssigneeInput("");
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Add
                    </button>
                  </div>
                  <datalist id="project-assignee-options">
                    {users.map((user) => (
                      <option key={user.id || user.email} value={user.email}>
                        {user.name}
                      </option>
                    ))}
                  </datalist>
                  {/* <p className="text-[11px] text-slate-500">Tag any responsible person using email or name. Separate multiple values with comma.</p> */}
                </div>
              </div>
              <div>
                <label htmlFor="project-start-date" className="mb-1 block text-sm font-medium text-slate-700">
                  Start Date
                </label>
                <input
                  id="project-start-date"
                  type="date"
                  value={newStartDate}
                  onChange={(event) => setNewStartDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="project-duration-days" className="mb-1 block text-sm font-medium text-slate-700">
                  Duration (Days)
                </label>
                <input
                  id="project-duration-days"
                  type="number"
                  min={1}
                  value={newDurationDays}
                  onChange={(event) => setNewDurationDays(Number(event.target.value))}
                  placeholder="30"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="project-team-size" className="mb-1 block text-sm font-medium text-slate-700">
                  Assigned People
                </label>
                <input
                  id="project-team-size"
                  type="number"
                  min={1}
                  value={newTeamSize}
                  onChange={(event) => setNewTeamSize(Number(event.target.value))}
                  placeholder="3"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="project-attachments" className="mb-1 block text-sm font-medium text-slate-700">
                  Attach documents
                </label>
                <input
                  id="project-attachments"
                  type="file"
                  multiple
                  onChange={(event) => {
                    const files = event.target.files ? Array.from(event.target.files) : [];
                    setProjectAttachments(files);
                  }}
                  className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
                />
                {projectAttachments.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {projectAttachments.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setProjectAttachments((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="text-[11px] font-medium text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
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
