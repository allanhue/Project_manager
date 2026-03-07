"use client";

import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "$19",
    note: "per org / month",
    features: ["Up to 5 users", "Projects and tasks", "Basic reports"],
  },
  {
    name: "Growth",
    price: "$49",
    note: "per org / month",
    features: ["Up to 25 users", "Approvals workflow", "Timesheets + analytics"],
    highlight: true,
  },
  {
    name: "Scale",
    price: "$99",
    note: "per org / month",
    features: ["Unlimited users", "Advanced governance", "Priority support"],
  },
];

export default function HomePage() {
  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{
        backgroundImage:
          "linear-gradient(115deg, rgba(2,6,23,0.86), rgba(15,23,42,0.66)), url('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-14">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">PulseForge</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Simple pricing for project, approvals and team execution.</h1>
          <p className="mt-4 text-sm text-slate-200 md:text-base">
            Manage delivery, approvals,sessions and reporting in one workspace designed for organization workspace
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/auth" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">
              Get Started
            </Link>
            <Link href="/auth" className="rounded-lg border border-slate-200/45 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
              Sign In
            </Link>
          </div>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-2xl border p-5 backdrop-blur-sm ${
                plan.highlight ? "border-sky-300 bg-sky-900/35" : "border-slate-200/20 bg-slate-900/35"
              }`}
            >
              <p className="text-sm font-semibold text-slate-100">{plan.name}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{plan.price}</p>
              <p className="mt-1 text-xs text-slate-300">{plan.note}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
