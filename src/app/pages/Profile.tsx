"use client";

import { FormEvent, useState } from "react";
import { AuthUser, updateCurrentUser } from "../auth/auth";

type ProfilePageProps = {
  user: AuthUser;
};

export default function ProfilePage({ user }: ProfilePageProps) {
  const [name, setName] = useState(user.name);
  const [status, setStatus] = useState("");

  function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateCurrentUser({ name });
    setStatus("Profile updated.");
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-600">Review your workspace identity and update your display information.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={onSave} className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">User Details</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">User ID</label>
              <input
                type="text"
                value={user.id}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              />
            </div>
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Save Profile
            </button>
            {status ? <p className="text-sm text-slate-600">{status}</p> : null}
          </div>
        </form>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Tenant Details</h3>
          <dl className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt>Tenant Slug</dt>
              <dd className="font-medium text-slate-900">{user.tenantSlug}</dd>
            </div>
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt>Tenant Name</dt>
              <dd className="font-medium text-slate-900">{user.tenantName || "Not set in token payload"}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}
