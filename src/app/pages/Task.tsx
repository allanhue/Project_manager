"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createTask, deleteTask, listProjects, listTasks, Project, TaskItem, updateTask } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

function chipClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "done" || normalized === "completed" || normalized === "closed") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (normalized === "in progress") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
}

function statusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "done" || normalized === "completed" || normalized === "closed") return "Done";
  if (normalized === "in progress") return "In Progress";
  if (normalized === "todo") return "To Do";
  return status;
}

function progressFromStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "done" || normalized === "completed" || normalized === "closed") return 100;
  if (normalized === "in progress") return 60;
  return 15;
}

type TasksPageProps = {
  searchQuery?: string;
};

export default function TasksPage({ searchQuery = "" }: TasksPageProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [taskCode, setTaskCode] = useState("");
  const [projectId, setProjectId] = useState("");
  const [phase, setPhase] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [subtasksText, setSubtasksText] = useState("");
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<number | null>(null);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [taskAttachments, setTaskAttachments] = useState<File[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [items, projectsData] = await Promise.all([listTasks(), listProjects()]);
        if (mounted) setTasks(items);
        if (mounted) setProjects(projectsData);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load tasks.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (openMenuTaskId === null) return undefined;
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-task-menu]")) return;
      setOpenMenuTaskId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenuTaskId]);

  useEffect(() => {
    if (!isBulkMenuOpen) return undefined;
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-task-bulk-menu]")) return;
      setIsBulkMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isBulkMenuOpen]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !projectId || submitting) return;
    setError("");
    setSubmitting(true);
    const subtasks = subtasksText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    try {
      const item = await createTask({
        task_code: taskCode.trim(),
        title: title.trim(),
        status,
        priority,
        project_id: Number(projectId),
        phase: phase.trim(),
        subtasks,
        attachments: taskAttachments.map((file) => file.name),
      });
      setTasks((prev) => [...prev, item]);
      setTitle("");
      setTaskCode("");
      setProjectId("");
      setPhase("");
      setStatus("todo");
      setPriority("medium");
      setSubtasksText("");
      setTaskAttachments([]);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTask || !title.trim() || !projectId || submitting) return;
    setError("");
    setSubmitting(true);
    const subtasks = subtasksText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    try {
      const updated = await updateTask({
        id: editingTask.id,
        task_code: taskCode.trim(),
        title: title.trim(),
        status,
        priority,
        project_id: Number(projectId),
        phase: phase.trim(),
        subtasks,
        attachments: taskAttachments.map((file) => file.name),
      });
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(task: TaskItem) {
    if (deletingTaskId !== null) return;
    setOpenMenuTaskId(null);
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setError("");
    setDeletingTaskId(task.id);
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      if (editingTask?.id === task.id) closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setDeletingTaskId(null);
    }
  }

  function openCreate() {
    setEditingTask(null);
    setTitle("");
    setTaskCode("");
    setProjectId("");
    setPhase("");
    setStatus("todo");
    setPriority("medium");
    setSubtasksText("");
    setTaskAttachments([]);
    setShowCreate(true);
  }

  function openEdit(task: TaskItem) {
    setOpenMenuTaskId(null);
    setEditingTask(task);
    setTitle(task.title);
    setTaskCode(task.task_code || "");
    setProjectId(String(task.project_id));
    setPhase(task.phase || "");
    setStatus(task.status || "todo");
    setPriority(task.priority || "medium");
    setSubtasksText((task.subtasks || []).join("\n"));
    setTaskAttachments([]);
    setShowCreate(true);
  }

  function closeForm() {
    if (submitting) return;
    setShowCreate(false);
    setEditingTask(null);
  }

  async function onBulkDelete() {
    if (selectedTasks.length === 0) return;
    if (!window.confirm(`Delete ${selectedTasks.length} selected task(s)?`)) return;
    setError("");
    try {
      for (const id of selectedTasks) {
        await deleteTask(id);
      }
      setTasks((prev) => prev.filter((task) => !selectedTasks.includes(task.id)));
      setSelectedTasks([]);
      setIsSelectionMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tasks.");
    }
  }

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) =>
      `${task.title} ${task.priority} ${task.status} ${task.project_name || ""} ${task.phase || ""} ${(task.subtasks || []).join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [tasks, searchQuery]);

  const completion = useMemo(() => {
    if (filteredTasks.length === 0) return 0;
    const total = filteredTasks.reduce((acc, task) => acc + progressFromStatus(task.status), 0);
    return Math.round(total / filteredTasks.length);
  }, [filteredTasks]);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Task Board</h2>
            <p className="text-sm text-slate-600">Plan daily execution, assign priorities, group work by phase and keep the oldest tasks first.</p>
            <div className="mt-3 w-full max-w-sm">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Completion</span>
                <span>{completion}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-sky-600 transition-all duration-300" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openCreate} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-px">
              New Task
            </button>
            <div className="relative" data-task-bulk-menu>
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
                        setSelectedTasks([]);
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
                          setSelectedTasks(filteredTasks.map((t) => t.id));
                          setIsBulkMenuOpen(false);
                        }}
                        disabled={filteredTasks.length === 0 || selectedTasks.length === filteredTasks.length}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTasks([]);
                          setIsBulkMenuOpen(false);
                        }}
                        disabled={selectedTasks.length === 0}
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
                        disabled={selectedTasks.length === 0}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete selected{selectedTasks.length ? ` (${selectedTasks.length})` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedTasks([]);
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

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <LoadingSpinner label="Loading tasks..." /> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {filteredTasks.length === 0 && !loading ? (
          <div className="px-2 py-4 text-center text-sm text-slate-500">No tasks match the current search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200">
                  {isSelectionMode ? (
                    <th className="px-2 py-2 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                        aria-label="Select all tasks"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTasks(filteredTasks.map((t) => t.id));
                          } else {
                            setSelectedTasks([]);
                          }
                        }}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                    </th>
                  ) : null}
                  <th className="px-2 py-2 font-medium">Task</th>
                  <th className="px-2 py-2 font-medium">Project</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Priority</th>
                  <th className="px-2 py-2 font-medium">Progress</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                    {isSelectionMode ? (
                      <td className="px-2 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          aria-label={`Select task ${task.title}`}
                          onChange={(e) =>
                            setSelectedTasks((prev) =>
                              e.target.checked ? [...prev, task.id] : prev.filter((id) => id !== task.id),
                            )
                          }
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-3 align-top">
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {task.task_code || `Task ${task.id}`} • {task.subtasks?.length || 0} subtasks
                      </p>
                    </td>
                    <td className="px-2 py-3 align-top text-sm text-slate-700">
                      {task.project_name || `Project ${task.project_id}`}
                      {task.phase?.trim() ? (
                        <span className="mt-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                          {task.phase}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${chipClass(task.status)}`}>
                        {statusLabel(task.status)}
                      </span>
                    </td>
                    <td className="px-2 py-3 align-top text-sm text-slate-700">{task.priority}</td>
                    <td className="px-2 py-3 align-top">
                      <div className="w-full min-w-[140px]">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{progressFromStatus(task.status)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200">
                          <div
                            className={`h-1.5 rounded-full ${
                              progressFromStatus(task.status) >= 100
                                ? "bg-emerald-500"
                                : progressFromStatus(task.status) >= 60
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                            }`}
                            style={{ width: `${progressFromStatus(task.status)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top text-sm text-slate-700">{new Date(task.created_at).toLocaleString()}</td>
                    <td className="px-2 py-3 align-top">
                      <div className="relative flex justify-end" data-task-menu>
                        <button
                          type="button"
                          onClick={() => setOpenMenuTaskId((prev) => (prev === task.id ? null : task.id))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                          aria-label={`Open actions for ${task.title}`}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>
                        {openMenuTaskId === task.id ? (
                          <div className="absolute right-0 top-11 z-10 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => openEdit(task)}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDelete(task)}
                              disabled={deletingTaskId === task.id}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingTaskId === task.id ? "Deleting..." : "Delete"}
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
        )}
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={editingTask ? onUpdate : onCreate}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingTask ? "Edit Task" : "Create Task"}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {editingTask
                  ? "Update task details, phase, and project linkage."
                  : "Attach work to a project, assign a phase, and break execution into subtasks."}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label htmlFor="task-project" className="mb-1 block text-sm font-medium text-slate-700">
                  Project
                </label>
                <select
                  id="task-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                  required
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="task-status" className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  id="task-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-sky-300"
                >
                  <option value="todo">To Do</option>
                  <option value="In progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="task-title" className="mb-1 block text-sm font-medium text-slate-700">
                  Task Title
                </label>
                <input
                  id="task-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Prepare handoff checklist"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="task-code" className="mb-1 block text-sm font-medium text-slate-700">
                  Task ID (Internal)
                </label>
                <input
                  id="task-code"
                  type="text"
                  value={taskCode}
                  onChange={(event) => setTaskCode(event.target.value)}
                  placeholder="TSK-001"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label htmlFor="task-phase" className="mb-1 block text-sm font-medium text-slate-700">
                  Phase
                </label>
                <input
                  id="task-phase"
                  type="text"
                  value={phase}
                  onChange={(event) => setPhase(event.target.value)}
                  placeholder="Design, Build, QA"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                />
              </div>
              <div>
                <label htmlFor="task-priority" className="mb-1 block text-sm font-medium text-slate-700">
                  Priority
                </label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
                <div className="md:col-span-2">
                  <label htmlFor="task-subtasks" className="mb-1 block text-sm font-medium text-slate-700">
                    Subtasks (one per line)
                  </label>
                  <textarea
                    id="task-subtasks"
                    rows={6}
                    value={subtasksText}
                    onChange={(event) => setSubtasksText(event.target.value)}
                    placeholder={"Create API endpoint\nAdd tests\nReview QA checklist"}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="task-attachments" className="mb-1 block text-sm font-medium text-slate-700">
                    Attach documents
                  </label>
                  <input
                    id="task-attachments"
                    type="file"
                    multiple
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      setTaskAttachments(files);
                    }}
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
                  />
                  {taskAttachments.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {taskAttachments.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setTaskAttachments((prev) => prev.filter((_, i) => i !== index))
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
                className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : null}
                {submitting ? (editingTask ? "Saving..." : "Creating...") : editingTask ? "Save Changes" : "Add Task"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
