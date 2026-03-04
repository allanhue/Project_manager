"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getUserSettings, sendSupportRequest, updateUserSettings, UserSettings } from "../auth/auth";

const defaultSettings: UserSettings = {
  timezone: "UTC",
  week_starts_on: "monday",
  reminder_frequency: "daily",
  reminder_days: ["monday", "wednesday", "friday"],
  reminder_time: "09:00",
  reminders_enabled: true,
  daily_digest: true,
  overdue_alerts: true,
  email_summaries: true,
  private_projects: true,
  log_retention_days: 180,
  admins_can_export: true,
};

const weekDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const timezones = ["UTC", "Africa/Nairobi", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const payload = await getUserSettings();
        if (!mounted) return;
        setSettings({ ...defaultSettings, ...payload });
      } catch {
        if (!mounted) return;
        setSettings(defaultSettings);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const showDayPicker = useMemo(() => settings.reminder_frequency === "weekly" || settings.reminder_frequency === "custom", [settings.reminder_frequency]);

  async function saveSettings() {
    if (savingSettings) return;
    setSavingSettings(true);
    setSettingsStatus("Saving settings...");
    try {
      const payload = {
        ...settings,
        reminder_days: showDayPicker ? settings.reminder_days : [],
      };
      const response = await updateUserSettings(payload);
      setSettingsStatus(response.status || "Settings saved.");
    } catch (err) {
      setSettingsStatus(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingSupport) return;
    setSendingSupport(true);
    setStatus("Sending...");
    try {
      await sendSupportRequest({ subject, priority, message });
      setStatus("Support request sent.");
      setSubject("");
      setPriority("normal");
      setMessage("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to send support request.");
    } finally {
      setSendingSupport(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-600">Configure reminder schedules, time zone, notifications, and workspace controls.</p>
      </header>

      <div className="max-h-[calc(100dvh-240px)] space-y-4 overflow-auto pr-1">
        <div className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Workspace Preferences</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-slate-700">Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-slate-700">Week starts on</label>
                <select
                  value={settings.week_starts_on}
                  onChange={(e) => setSettings((prev) => ({ ...prev, week_starts_on: e.target.value as "monday" | "sunday" }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none"
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Reminder Schedule</h3>
            <div className="space-y-3 text-sm">
              <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>Enable reminders</span>
                <input type="checkbox" checked={settings.reminders_enabled} onChange={(e) => setSettings((prev) => ({ ...prev, reminders_enabled: e.target.checked }))} />
              </label>
              <div>
                <label className="mb-1 block text-slate-700">Frequency</label>
                <select
                  value={settings.reminder_frequency}
                  onChange={(e) => setSettings((prev) => ({ ...prev, reminder_frequency: e.target.value as "daily" | "weekly" | "custom" }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom days</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-slate-700">Reminder time</label>
                <input type="time" value={settings.reminder_time} onChange={(e) => setSettings((prev) => ({ ...prev, reminder_time: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none" />
              </div>
              {showDayPicker ? (
                <div>
                  <label className="mb-1 block text-slate-700">Days of week</label>
                  <div className="grid grid-cols-2 gap-2">
                    {weekDays.map((day) => {
                      const checked = settings.reminder_days.includes(day);
                      return (
                        <label key={day} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                reminder_days: e.target.checked ? [...prev.reminder_days, day] : prev.reminder_days.filter((d) => d !== day),
                              }))
                            }
                          />
                          <span className="capitalize">{day}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Notifications & Access</h3>
            <div className="space-y-3 text-sm text-slate-700">
              {[
                ["Daily digest", "daily_digest"],
                ["Task overdue alerts", "overdue_alerts"],
                ["Email summaries", "email_summaries"],
                ["Private projects", "private_projects"],
                ["Admins can export reports", "admins_can_export"],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings[key as keyof UserSettings])}
                    onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.checked } as UserSettings))}
                  />
                </label>
              ))}
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <label className="mb-1 block">Log retention days</label>
                <input type="number" min={1} value={settings.log_retention_days} onChange={(e) => setSettings((prev) => ({ ...prev, log_retention_days: Number(e.target.value) || 1 }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none" />
              </div>
            </div>
          </article>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            {settingsStatus ? <p className="text-sm text-slate-700">{settingsStatus}</p> : <span />}
            <button type="button" onClick={() => void saveSettings()} disabled={savingSettings} className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-500">
              {savingSettings ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : null}
              {savingSettings ? "Saving..." : "Save Workspace Settings"}
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Help & Support</h3>
          <p className="mb-3 text-sm text-slate-600">Submit issues to system administration.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input type="text" required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none" />
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <textarea required rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe your issue and impact." className="mt-3 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none" />
          <div className="mt-3 flex items-center justify-between gap-3">
            {status ? <p className="text-sm text-slate-600">{status}</p> : <span />}
            <button type="submit" disabled={sendingSupport} className="inline-flex min-w-[168px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-500">
              {sendingSupport ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : null}
              {sendingSupport ? "Submitting..." : "Submit Support Request"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

