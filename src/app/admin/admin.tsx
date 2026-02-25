export default function AdminPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Admin Console</h2>
        <p className="text-sm text-slate-600">
          Multi-tenant controls UI placeholder. Auth and API wiring can be layered next.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Tenant Overview</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="rounded-lg bg-slate-50 px-3 py-2">Acme Labs - 38 users - Pro plan</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Northwind - 12 users - Standard plan</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Horizon Media - 22 users - Pro plan</li>
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Platform Health</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="rounded-lg bg-slate-50 px-3 py-2">API latency: 162 ms</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Queue processing: Stable</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Failed webhooks: 2 in 24h</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
