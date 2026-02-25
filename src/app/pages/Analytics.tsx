const metrics = [
  { label: "Planned vs Completed", value: "82%" },
  { label: "Avg Lead Time", value: "4.6 days" },
  { label: "Blocker Resolution", value: "91%" },
  { label: "Team Utilization", value: "76%" },
];

export default function AnalyticsPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Analytics</h2>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <article key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Delivery Pulse</h3>
        <p className="text-sm text-slate-600">
          This section is ready for API-backed charts later. For now it provides clean UI placeholders to continue page
          and component design.
        </p>
      </div>
    </section>
  );
}
