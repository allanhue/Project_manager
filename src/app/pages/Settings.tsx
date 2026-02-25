const groups = [
  {
    title: "Workspace Preferences",
    items: ["Default timezone: East Africa Time", "Week starts on Monday", "Project numbering prefix: PF"],
  },
  {
    title: "Notifications",
    items: ["Daily digest: Enabled", "Task overdue alerts: Enabled", "Email summaries: Disabled"],
  },
  {
    title: "Visibility",
    items: ["Private projects require invitation", "Activity logs retained for 180 days", "Admins can export reports"],
  },
];

export default function SettingsPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-600">Configure workspace defaults before connecting auth and tenant policies.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        {groups.map((group) => (
          <article key={group.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{group.title}</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {group.items.map((item) => (
                <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
