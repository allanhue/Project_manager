"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createTask, listProjects, listTasks, Project, TaskItem, updateTask } from "../auth/auth";
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
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [subtasksText, setSubtasksText] = useState("");
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const item = await createTask({ task_code: taskCode.trim(), title: title.trim(), status, priority, project_id: Number(projectId), subtasks });
      setTasks((prev) => [item, ...prev]);
      setTitle("");
      setTaskCode("");
      setProjectId("");
      setStatus("todo");
      setPriority("medium");
      setSubtasksText("");
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
        subtasks,
      });
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setSubmitting(false);
    }
  }

  function openCreate() {
    setEditingTask(null);
    setTitle("");
    setTaskCode("");
    setProjectId("");
    setStatus("todo");
    setPriority("medium");
    setSubtasksText("");
    setShowCreate(true);
  }

  function openEdit(task: TaskItem) {
    setEditingTask(task);
    setTitle(task.title);
    setTaskCode(task.task_code || "");
    setProjectId(String(task.project_id));
    setStatus(task.status || "todo");
    setPriority(task.priority || "medium");
    setSubtasksText((task.subtasks || []).join("\n"));
    setShowCreate(true);
  }

  function closeForm() {
    if (submitting) return;
    setShowCreate(false);
    setEditingTask(null);
  }

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) => `${task.title} ${task.priority} ${task.status} ${task.project_name || ""} ${(task.subtasks || []).join(" ")}`.toLowerCase().includes(q));
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
            <p className="text-sm text-slate-600">Plan daily execution, assign priorities and track delivery outcomes.</p>
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
          <button type="button" onClick={openCreate} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-[1px]">
            New Task
          </button>
        </div>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <LoadingSpinner label="Loading tasks..." /> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Task</th>
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Priority</th>
                <th className="px-2 py-2 font-medium">Progress</th>
                <th className="px-2 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-3 font-medium text-slate-900">{task.title}</td>
                  <td className="px-2 py-3 text-slate-700">{task.project_name || task.project_id}</td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${chipClass(task.status)}`}>{statusLabel(task.status)}</span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{task.priority}</td>
                  <td className="px-2 py-3 text-slate-700">
                    <div className="w-40">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{task.subtasks?.length || 0} subtasks</span>
                        <span>{progressFromStatus(task.status)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200">
                        <div className={`h-1.5 rounded-full ${progressFromStatus(task.status) >= 100 ? "bg-emerald-500" : progressFromStatus(task.status) >= 60 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${progressFromStatus(task.status)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{new Date(task.created_at).toLocaleString()}</td>
                  <td className="px-2 py-3">
                    <button type="button" onClick={() => openEdit(task)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <form onSubmit={editingTask ? onUpdate : onCreate} className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingTask ? "Edit Task" : "Create Task"}</h3>
              <p className="mt-1 text-sm text-slate-600">{editingTask ? "Update task details and project linkage." : "Attach work to a project and break execution into subtasks."}</p>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300" required>
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-sky-300">
                  <option value="todo">To Do</option>
                  <option value="In progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Task Title</label>
                <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prepare handoff checklist" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Task ID (Internal)</label>
                <input
                  type="text"
                  value={taskCode}
                  onChange={(event) => setTaskCode(event.target.value)}
                  placeholder="TSK-001"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300">
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Subtasks (one per line)</label>
                <textarea rows={6} value={subtasksText} onChange={(event) => setSubtasksText(event.target.value)} placeholder={"Create API endpoint\nAdd tests\nReview QA checklist"} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" />
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
