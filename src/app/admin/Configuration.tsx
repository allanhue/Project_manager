"use client";

import { FormEvent, useEffect, useState } from "react";
import { createSystemTenant, getSystemTenants, SystemTenant, updateSystemTenant } from "../auth/auth";

export default function SystemConfigurationPage() {
  const [items, setItems] = useState<SystemTenant[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SystemTenant | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  async function loadTenants() {
    setError("");
    try {
      const data = await getSystemTenants();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants.");
    }
  }

  useEffect(() => {
    void loadTenants();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving...");
    try {
      const created = await createSystemTenant({ slug: slug.trim().toLowerCase(), name: name.trim() });
      setItems((prev) => [created, ...prev]);
      setSlug("");
      setName("");
      setShowCreate(false);
      setStatus("Tenant created.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create tenant.");
    }
  }

  async function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setStatus("Saving...");
    try {
      const updated = await updateSystemTenant({
        id: editing.id,
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      setSlug("");
      setName("");
      setStatus("Tenant updated.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to update tenant.");
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">System Configuration</h2>
        <p className="text-sm text-slate-600">Create and update organization tenants, names, and org IDs (tenant slug).</p>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Tenant Directory</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadTenants()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setSlug("");
                setName("");
                setShowCreate(true);
              }}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Add Tenant
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Tenant ID</th>
                <th className="px-2 py-2 font-medium">Org ID (Slug)</th>
                <th className="px-2 py-2 font-medium">Organization Name</th>
                <th className="px-2 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-2 py-3 text-slate-700">{item.id}</td>
                  <td className="px-2 py-3 font-mono text-xs text-slate-800">{item.slug}</td>
                  <td className="px-2 py-3 text-slate-700">{item.name}</td>
                  <td className="px-2 py-3 text-slate-700">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setSlug(item.slug);
                        setName(item.name);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(showCreate || editing) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={editing ? onUpdate : onCreate} className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{editing ? "Edit Tenant" : "Add Tenant"}</h3>
            <p className="mt-1 text-sm text-slate-600">Update tenant identity used across projects and tasks.</p>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Org ID (Slug)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="acme"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Organization Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Inc"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  required
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                {editing ? "Save Changes" : "Create Tenant"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
