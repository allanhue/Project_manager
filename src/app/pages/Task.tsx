const columns = [
  {
    title: "Backlog",
    tasks: ["Setup tenant default roles", "Map activity log event model", "Define project template form"],
  },
  {
    title: "In Progress",
    tasks: ["Build projects list UI", "Implement task details panel", "Add sidebar filters"],
  },
  {
    title: "Review",
    tasks: ["Validate white theme contrast", "Review dashboard widget copy"],
  },
  {
    title: "Done",
    tasks: ["Create page-first implementation path", "Define component split strategy"],
  },
];

export default function TasksPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Task Board</h2>
        <p className="text-sm text-slate-600">Prioritize execution while you finish page and component layer first.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => (
          <article key={column.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{column.title}</h3>
            <ul className="space-y-2">
              {column.tasks.map((task) => (
                <li key={task} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {task}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
