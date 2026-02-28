"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSystemUpdate, getSession, getSystemUpdates, listProjects, listTasks, Project, SystemUpdate, TaskItem, updateSystemUpdate } from "../auth/auth";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(() => startOfMonth(new Date()));
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUpdateID, setEditingUpdateID] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [expectations, setExpectations] = useState("");

  const role = getSession()?.user.role || "org_admin";
  const isSystemAdmin = role === "system_admin";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [projectItems, taskItems] = await Promise.all([listProjects(), listTasks()]);
        if (!mounted) return;
        setProjects(projectItems);
        setTasks(taskItems);

        if (isSystemAdmin) {
          const sysUpdates = await getSystemUpdates();
          if (!mounted) return;
          setUpdates(sysUpdates);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load calendar.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isSystemAdmin]);

  async function onCreateSystemUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("Scheduling update and sending emails...");
    const selected = new Date(scheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!scheduledDate || selected <= today) {
      setError("Select a date after today.");
      setStatus("");
      return;
    }
    try {
      const payload = {
        scheduled_date: scheduledDate,
        title: title.trim(),
        feature_brief: brief.trim(),
        expectations: expectations.trim(),
      };
      const result =
        editingUpdateID === null
          ? await createSystemUpdate(payload)
          : await updateSystemUpdate({
              id: editingUpdateID,
              ...payload,
            });
      setUpdates((prev) => {
        const items = editingUpdateID === null ? [result.item, ...prev] : prev.map((item) => (item.id === editingUpdateID ? result.item : item));
        return items.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
      });
      setStatus(
        editingUpdateID === null
          ? `Update scheduled. Emails sent: ${result.sent}/${result.recipients} (failed: ${result.failed}).`
          : `Update revised. Emails sent: ${result.sent}/${result.recipients} (failed: ${result.failed}).`,
      );
      setScheduledDate("");
      setTitle("");
      setBrief("");
      setExpectations("");
      setEditingUpdateID(null);
      setShowForm(false);
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : "Failed to create system update.");
    }
  }

  function startEditingUpdate(item: SystemUpdate) {
    setEditingUpdateID(item.id);
    setScheduledDate(item.scheduled_date);
    setTitle(item.title);
    setBrief(item.feature_brief);
    setExpectations(item.expectations);
    setShowForm(true);
    setError("");
    setStatus("");
  }

  const days = useMemo(() => {
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const firstWeekday = (monthStart.getDay() + 6) % 7;
    const totalDays = monthEnd.getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= totalDays; day++) {
      cells.push(new Date(current.getFullYear(), current.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [current]);

  const projectByID = useMemo(() => {
    const map = new Map<number, Project>();
    for (const project of projects) map.set(project.id, project);
    return map;
  }, [projects]);

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{isSystemAdmin ? "System Update Calendar" : "Calendar Module"}</h2>
            <p className="text-sm text-slate-600">
              {isSystemAdmin
                ? "Document and schedule platform updates with tenant-wide email communication."
                : "Monthly timeline for project starts, deadlines and related task pressure."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrent((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              Previous
            </button>
            <p className="min-w-[180px] text-center text-sm font-semibold text-slate-900">
              {current.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => setCurrent((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              Next
            </button>
            {isSystemAdmin ? (
              <button type="button" onClick={() => setShowForm((prev) => !prev)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                {showForm ? "Close Form" : "Schedule Update"}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {status ? <p className="text-sm text-emerald-700">{status}</p> : null}

      {isSystemAdmin && showForm ? (
        <form onSubmit={onCreateSystemUpdate} className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{editingUpdateID === null ? "Platform Update Announcement" : "Edit Scheduled Update"}</h3>
          <p className="mt-1 text-sm text-slate-600">Choose a future date. This announcement will be documented and emailed to all tenant org admins.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Feature Title</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="New role-based approvals"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Brief</label>
              <textarea
                rows={4}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Short summary of what is changing."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Expectation</label>
              <textarea
                rows={4}
                value={expectations}
                onChange={(event) => setExpectations(event.target.value)}
                placeholder="What tenants should prepare or expect."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                required
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="flex gap-2">
              {editingUpdateID !== null ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUpdateID(null);
                    setScheduledDate("");
                    setTitle("");
                    setBrief("");
                    setExpectations("");
                    setShowForm(false);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel Edit
                </button>
              ) : null}
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                {editingUpdateID === null ? "Save and Send to All Tenants" : "Update and Re-send"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <div key={label} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="min-h-[130px] rounded-lg border border-dashed border-slate-200 bg-slate-50/60" />;
            const dueProjects = projects.filter((project) => project.due_date && sameDay(new Date(project.due_date), day));
            const starts = projects.filter((project) => project.start_date && sameDay(new Date(project.start_date), day));
            const dueTasks = tasks.filter((task) => {
              const project = projectByID.get(task.project_id);
              if (!project?.due_date) return false;
              if (task.status === "done") return false;
              return sameDay(new Date(project.due_date), day);
            });
            const dayUpdates = updates.filter((item) => sameDay(new Date(item.scheduled_date), day));
            const isToday = sameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`group min-h-[130px] rounded-lg border p-2 transition hover:-translate-y-[2px] hover:shadow-md ${
                  isToday ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white hover:border-sky-300"
                }`}
              >
                <p className={`text-xs font-semibold ${isToday ? "text-sky-700" : "text-slate-700"}`}>{day.getDate()}</p>
                <div className="mt-2 space-y-1">
                  {dayUpdates.slice(0, 2).map((item) => (
                    <div key={`update-${item.id}`} className="flex items-center gap-1">
                      <p className="truncate rounded bg-indigo-100 px-2 py-1 text-[11px] text-indigo-800">Update: {item.title}</p>
                      {isSystemAdmin ? (
                        <button
                          type="button"
                          onClick={() => startEditingUpdate(item)}
                          className="hidden rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white group-hover:inline-block"
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {starts.slice(0, 2).map((project) => (
                    <p key={`start-${project.id}`} className="truncate rounded bg-sky-100 px-2 py-1 text-[11px] text-sky-800">
                      Start: {project.name}
                    </p>
                  ))}
                  {dueProjects.slice(0, 2).map((project) => (
                    <p key={`due-${project.id}`} className="truncate rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-800">
                      Due: {project.name}
                    </p>
                  ))}
                  {dueTasks.length > 0 ? <p className="rounded bg-rose-100 px-2 py-1 text-[11px] text-rose-800">{dueTasks.length} open task(s)</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
