"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createTimesheet, listProjects, listTasks, listTimesheets, Project, TaskItem, TimesheetEntry, TimesheetSummary } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

type TimesheetsPageProps = {
  searchQuery?: string;
};

export default function TimesheetsPage({ searchQuery = "" }: TimesheetsPageProps) {
  const [items, setItems] = useState<TimesheetEntry[]>([]);
  const [summary, setSummary] = useState<TimesheetSummary>({ billable_hours: 0, non_billable_hours: 0, total_hours: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("8");
  const [billable, setBillable] = useState(true);
  const [notes, setNotes] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [timesheetsPayload, projectsPayload, tasksPayload] = await Promise.all([listTimesheets(), listProjects(), listTasks()]);
      setItems(timesheetsPayload.items);
      setSummary(timesheetsPayload.summary);
      setProjects(projectsPayload);
      setTasks(tasksPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timesheets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredTasks = useMemo(() => {
    if (!projectId) return tasks;
    return tasks.filter((task) => String(task.project_id) === projectId);
  }, [tasks, projectId]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.project_name || ""} ${item.task_title || ""} ${item.notes || ""} ${item.created_by_email} ${item.billable ? "billable" : "non-billable"}`
        .toLowerCase()
        .includes(q),
    );
  }, [items, searchQuery]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsedHours = Number(hours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      setError("Hours must be between 0 and 24.");
      return;
    }
    try {
      await createTimesheet({
        project_id: projectId ? Number(projectId) : null,
        task_id: taskId ? Number(taskId) : null,
        work_date: workDate,
        hours: parsedHours,
        billable,
        notes: notes.trim(),
      });
      setShowCreate(false);
      setProjectId("");
      setTaskId("");
      setWorkDate(new Date().toISOString().slice(0, 10));
      setHours("8");
      setBillable(true);
      setNotes("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log time.");
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Timesheets</h2>
            <p className="text-sm text-slate-600">Track billable and non-billable hours across projects and tasks.</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-[1px]">
            Log Hours
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Billable</p>
          <p className="text-2xl font-semibold text-emerald-700">{summary.billable_hours.toFixed(2)}h</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Non-Billable</p>
          <p className="text-2xl font-semibold text-amber-700">{summary.non_billable_hours.toFixed(2)}h</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-2xl font-semibold text-slate-900">{summary.total_hours.toFixed(2)}h</p>
        </article>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <LoadingSpinner label="Loading timesheets..." /> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Task</th>
                <th className="px-2 py-2 font-medium">Hours</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Notes</th>
                <th className="px-2 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-3 text-slate-700">{new Date(entry.work_date).toLocaleDateString()}</td>
                  <td className="px-2 py-3 text-slate-700">{entry.project_name || "-"}</td>
                  <td className="px-2 py-3 text-slate-700">{entry.task_title || "-"}</td>
                  <td className="px-2 py-3 font-medium text-slate-900">{entry.hours.toFixed(2)}h</td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${entry.billable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {entry.billable ? "Billable" : "Non-Billable"}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{entry.notes || "-"}</td>
                  <td className="px-2 py-3 text-slate-700">{entry.created_by_email}</td>
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
              <h3 className="text-lg font-semibold text-slate-900">Log Timesheet Entry</h3>
              <p className="mt-1 text-sm text-slate-600">Capture work date, hours, and whether the effort is billable.</p>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300">
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Task</label>
                <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300">
                  <option value="">No task</option>
                  {filteredTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Hours</label>
                <input type="number" min={0.25} max={24} step={0.25} value={hours} onChange={(event) => setHours(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Work Type</label>
                <select value={billable ? "billable" : "non_billable"} onChange={(event) => setBillable(event.target.value === "billable")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300">
                  <option value="billable">Billable</option>
                  <option value="non_billable">Non Billable</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Client workshop and follow-up documentation." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Save Entry
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
