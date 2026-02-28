"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSession, sendSupportRequest } from "../auth/auth";

type WorkspaceSettings = {
  timezone: string;
  weekStartsOn: "monday" | "sunday";
  projectPrefix: string;
  dailyDigest: boolean;
  overdueAlerts: boolean;
  emailSummaries: boolean;
  privateProjects: boolean;
  logRetentionDays: number;
  adminsCanExport: boolean;
};

const defaultSettings: WorkspaceSettings = {
  timezone: "East Africa Time",
  weekStartsOn: "monday",
  projectPrefix: "PF",
  dailyDigest: true,
  overdueAlerts: true,
  emailSummaries: false,
  privateProjects: true,
  logRetentionDays: 180,
  adminsCanExport: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<WorkspaceSettings>(defaultSettings);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const tenantSlug = getSession()?.user.tenantSlug || "default";
    const raw = window.localStorage.getItem(`workspace_settings_${tenantSlug}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as WorkspaceSettings;
      setSettings({ ...defaultSettings, ...parsed });
    } catch {}
  }, []);

  function saveSettings() {
    const tenantSlug = getSession()?.user.tenantSlug || "default";
    window.localStorage.setItem(`workspace_settings_${tenantSlug}`, JSON.stringify(settings));
    setSettingsStatus("Settings saved.");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Sending...");
    try {
      await sendSupportRequest({ subject, priority, message });
      setStatus("Support request sent.");
      setSubject("");
      setPriority("normal");
      setMessage("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to send support request.");
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-600">Configure workspace defaults before connecting auth and tenant policies.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Workspace Preferences</h3>
          <div className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-slate-700">Default timezone</label>
              <input
                value={settings.timezone}
                onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-700">Week starts on</label>
              <select
                value={settings.weekStartsOn}
                onChange={(e) => setSettings((prev) => ({ ...prev, weekStartsOn: e.target.value as "monday" | "sunday" }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-300"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-slate-700">Project numbering prefix</label>
              <input
                value={settings.projectPrefix}
                onChange={(e) => setSettings((prev) => ({ ...prev, projectPrefix: e.target.value.toUpperCase() }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-300"
              />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Notifications</h3>
          <div className="space-y-3 text-sm text-slate-700">
            {[
              ["Daily digest", "dailyDigest"],
              ["Task overdue alerts", "overdueAlerts"],
              ["Email summaries", "emailSummaries"],
            ].map(([label, key]) => (
              <label key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings[key as keyof WorkspaceSettings])}
                  onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
              </label>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Visibility</h3>
          <div className="space-y-3 text-sm">
            <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
              <span>Private projects require invitation</span>
              <input
                type="checkbox"
                checked={settings.privateProjects}
                onChange={(e) => setSettings((prev) => ({ ...prev, privateProjects: e.target.checked }))}
              />
            </label>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
              <label className="mb-1 block">Activity logs retained (days)</label>
              <input
                type="number"
                min={1}
                value={settings.logRetentionDays}
                onChange={(e) => setSettings((prev) => ({ ...prev, logRetentionDays: Number(e.target.value) || 1 }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-300"
              />
            </div>
            <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
              <span>Admins can export reports</span>
              <input
                type="checkbox"
                checked={settings.adminsCanExport}
                onChange={(e) => setSettings((prev) => ({ ...prev, adminsCanExport: e.target.checked }))}
              />
            </label>
          </div>
        </article>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          {settingsStatus ? <p className="text-sm text-emerald-700">{settingsStatus}</p> : <span />}
          <button type="button" onClick={saveSettings} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Save Workspace Settings
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Support Mailbox</h3>
        <p className="mb-3 text-sm text-slate-600">Need help from system administration? Submit your request here.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
          />
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
          </select>
        </div>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe your issue and the impact."
          className="mt-3 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          {status ? <p className="text-sm text-slate-600">{status}</p> : <span />}
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Submit Support Request
          </button>
        </div>
      </form>
    </section>
  );
}

