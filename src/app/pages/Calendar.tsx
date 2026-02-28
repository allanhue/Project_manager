"use client";

import { useEffect, useMemo, useState } from "react";
import { listProjects, listTasks, Project, TaskItem } from "../auth/auth";

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
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [projectItems, taskItems] = await Promise.all([listProjects(), listTasks()]);
        if (!mounted) return;
        setProjects(projectItems);
        setTasks(taskItems);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load calendar.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
            <h2 className="text-lg font-semibold text-slate-900">Calendar Module</h2>
            <p className="text-sm text-slate-600">Monthly timeline for project starts, deadlines, and related task pressure.</p>
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
          </div>
        </div>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

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
            if (!day) return <div key={`empty-${index}`} className="min-h-[120px] rounded-lg border border-dashed border-slate-200 bg-slate-50/60" />;
            const dueProjects = projects.filter((project) => project.due_date && sameDay(new Date(project.due_date), day));
            const starts = projects.filter((project) => project.start_date && sameDay(new Date(project.start_date), day));
            const dueTasks = tasks.filter((task) => {
              const project = projectByID.get(task.project_id);
              if (!project?.due_date) return false;
              if (task.status === "done") return false;
              return sameDay(new Date(project.due_date), day);
            });
            const isToday = sameDay(day, new Date());

            return (
              <div key={day.toISOString()} className={`min-h-[120px] rounded-lg border p-2 ${isToday ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white"}`}>
                <p className={`text-xs font-semibold ${isToday ? "text-sky-700" : "text-slate-700"}`}>{day.getDate()}</p>
                <div className="mt-2 space-y-1">
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

