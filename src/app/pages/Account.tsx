import { pricingPlans } from "./pricingPlans";

export default function AccountPage() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Account</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Plans &amp; pricing</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Compare plans and features for your team. Every plan includes a shared workspace for organizing projects and getting work done.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {pricingPlans.map((plan) => (
          <article
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${
              plan.highlight ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"
            }`}
          >
            {plan.highlight ? (
              <span className="absolute right-4 top-4 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                Most popular
              </span>
            ) : null}
            <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">{plan.price}</p>
            <p className="mt-1 text-sm text-slate-500">{plan.note}</p>
            <div className="my-5 border-t border-slate-100" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Included</p>
            <ul className="mt-4 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m4 10 4 4 8-8" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
        Need help choosing a plan? Contact your workspace administrator for account and billing support.
      </p>
    </section>
  );
}
