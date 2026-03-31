"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createTimesheet,
  listProjects,
  listTasks,
  listTimesheets,
  Project,
  TaskItem,
  TimesheetEntry,
  TimesheetSummary,
  deleteTimesheet,
} from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

type TimesheetsPageProps = {
  searchQuery?: string;
};

export default function TimesheetsPage({ searchQuery = "" }: TimesheetsPageProps) {
  const [items, setItems] = useState<TimesheetEntry[]>([]);
  const [summary, setSummary] = useState<TimesheetSummary>({
    billable_hours: 0,
    non_billable_hours: 0,
    total_hours: 0,
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [workDate, setWorkDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [hours, setHours] = useState("8");
  const [billable, setBillable] = useState(true);
  const [notes, setNotes] = useState("");

  const [openMenuTimesheetId, setOpenMenuTimesheetId] = useState<number | null>(null);
  const [deletingTimesheetId, setDeletingTimesheetId] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [timesheetsPayload, projectsPayload, tasksPayload] =
        await Promise.all([listTimesheets(), listProjects(), listTasks()]);
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
      `${item.project_name || ""} ${item.task_title || ""} ${item.notes || ""} ${
        item.created_by_email
      } ${item.billable ? "billable" : "non-billable"}`
        .toLowerCase()
        .includes(q)
    );
  }, [items, searchQuery]);

  async function onDelete(entry: TimesheetEntry) {
    if (deletingTimesheetId !== null) return;
    setOpenMenuTimesheetId(null);
    if (!window.confirm(`Delete timesheet entry for ${entry.work_date}?`)) return;

    setError("");
    setDeletingTimesheetId(entry.id);

    try {
      await deleteTimesheet(entry.id);

      const newItems = items.filter((item) => item.id !== entry.id);
      setItems(newItems);

      const billable = newItems
        .filter((i) => i.billable)
        .reduce((sum, i) => sum + i.hours, 0);

      const nonBillable = newItems
        .filter((i) => !i.billable)
        .reduce((sum, i) => sum + i.hours, 0);

      setSummary({
        billable_hours: billable,
        non_billable_hours: nonBillable,
        total_hours: billable + nonBillable,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete timesheet.");
    } finally {
      setDeletingTimesheetId(null);
    }
  }

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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Timesheets</h2>
            <p className="text-sm text-slate-600">
              Track billable and non-billable hours.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Log Hours
          </button>
        </div>
      </header>

      {loading && <LoadingSpinner label="Loading..." />}
      {error && <p className="text-red-500">{error}</p>}

      {/* ✅ Responsive Table / Cards */}
      <div className="rounded-xl border bg-white p-4">
        {/* Desktop */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th>Date</th>
                <th>Project</th>
                <th>Task</th>
                <th>Hours</th>
                <th>Type</th>
                <th>Notes</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((e) => (
                <tr key={e.id} className="border-b">
                  <td>{new Date(e.work_date).toLocaleDateString()}</td>
                  <td>{e.project_name}</td>
                  <td>{e.task_title}</td>
                  <td>{e.hours}</td>
                  <td>{e.billable ? "Billable" : "Non"}</td>
                  <td>{e.notes}</td>
                  <td>{e.created_by_email}</td>
                  <td>
                    <button onClick={() => onDelete(e)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-3">
          {filteredItems.map((e) => (
            <div key={e.id} className="border rounded p-3">
              <p><strong>Date:</strong> {new Date(e.work_date).toLocaleDateString()}</p>
              <p><strong>Project:</strong> {e.project_name}</p>
              <p><strong>Task:</strong> {e.task_title}</p>
              <p><strong>Hours:</strong> {e.hours}</p>
              <p><strong>Type:</strong> {e.billable ? "Billable" : "Non"}</p>
              <p><strong>Notes:</strong> {e.notes}</p>
              <p><strong>By:</strong> {e.created_by_email}</p>
              <button
                onClick={() => onDelete(e)}
                className="mt-2 text-red-500"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}