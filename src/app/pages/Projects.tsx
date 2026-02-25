const projects = [
  { name: "Tenant Provisioning", owner: "Platform Team", progress: 72, status: "In Progress" },
  { name: "Billing Integration", owner: "Finance Ops", progress: 49, status: "At Risk" },
  { name: "Role Permissions", owner: "Security", progress: 87, status: "On Track" },
  { name: "Client Portal Refresh", owner: "Frontend", progress: 64, status: "In Progress" },
];

function statusClass(status: string) {
  if (status === "On Track") return "bg-emerald-50 text-emerald-700";
  if (status === "At Risk") return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

export default function ProjectsPage() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Project Portfolio</h2>
          <p className="text-sm text-slate-600">Track milestones and delivery health across all active programs.</p>
        </div>
        <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
          New Project
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-2 py-2 font-medium">Project</th>
              <th className="px-2 py-2 font-medium">Owner</th>
              <th className="px-2 py-2 font-medium">Progress</th>
              <th className="px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.name} className="border-b border-slate-100">
                <td className="px-2 py-3 font-medium text-slate-900">{project.name}</td>
                <td className="px-2 py-3 text-slate-700">{project.owner}</td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-sky-500" style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="text-xs text-slate-600">{project.progress}%</span>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(project.status)}`}>
                    {project.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
