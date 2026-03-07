"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSession, getUserSettings, listSessions, sendSupportRequest, SessionItem, updateSessionAction, updateUserSettings, UserSettings } from "../auth/auth";

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
  approval_pipeline: "simple",
  approval_email_notifications: true,
  approval_approvers: [],
};

const weekDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const timezones = ["UTC", "Africa/Nairobi", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsStatus, setSessionsStatus] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [approvalEmailInput, setApprovalEmailInput] = useState("");
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
  const currentUser = getSession()?.user;

  async function loadSessionsData() {
    setLoadingSessions(true);
    setSessionsStatus("");
    try {
      const payload = await listSessions();
      setSessions(payload);
    } catch (err) {
      setSessionsStatus(err instanceof Error ? err.message : "Failed to load sessions.");
    } finally {
      setLoadingSessions(false);
    }
  }

  function addApproverFromInput() {
    const raw = approvalEmailInput.trim().toLowerCase();
    if (!raw) return;
    setSettings((prev) => ({
      ...prev,
      approval_approvers: prev.approval_approvers.includes(raw) ? prev.approval_approvers : [...prev.approval_approvers, raw],
    }));
    setApprovalEmailInput("");
  }

  function removeApprover(email: string) {
    setSettings((prev) => ({ ...prev, approval_approvers: prev.approval_approvers.filter((item) => item !== email) }));
  }

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
            <p className="text-sm text-slate-600">Configure reminder schedules, time zone, notifications and workspace controls.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAdvanced(true);
              void loadSessionsData();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 1 0 12 8.5z" />
              <path d="M4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4" />
            </svg>
            Advanced Settings
          </button>
        </div>
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

      {showAdvanced ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Advanced Settings</h3>
                <p className="text-xs text-slate-600">Approvals pipeline and session controls.</p>
              </div>
              <button type="button" onClick={() => setShowAdvanced(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                Close
              </button>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">Approvals</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="mb-1 block text-slate-700">Approval Pipeline</label>
                    <select
                      value={settings.approval_pipeline}
                      onChange={(event) => setSettings((prev) => ({ ...prev, approval_pipeline: event.target.value as "simple" | "multi_approval" }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none"
                    >
                      <option value="simple">Simple</option>
                      <option value="multi_approval">Multi Approval</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      {settings.approval_pipeline === "multi_approval" ? "Requires two approvals before final approval status." : "Single approval finalizes the request."}
                    </p>
                  </div>
                  <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>Email approval notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.approval_email_notifications}
                      onChange={(event) => setSettings((prev) => ({ ...prev, approval_email_notifications: event.target.checked }))}
                    />
                  </label>
                  <div className="rounded-lg border border-slate-200 p-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      {settings.approval_pipeline === "multi_approval" ? "Approver Emails (ordered sequence)" : "Approver Email"}
                    </label>
                    <div className="mb-2 flex flex-wrap gap-2">
                      {settings.approval_approvers.length === 0 ? <span className="text-xs text-slate-500">No approver configured.</span> : null}
                      {settings.approval_approvers.map((email, index) => (
                        <span key={email} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-800">
                          {settings.approval_pipeline === "multi_approval" ? `${index + 1}. ` : ""}
                          {email}
                          <button type="button" onClick={() => removeApprover(email)} className="rounded-full px-1 text-slate-500 hover:bg-slate-200">
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={approvalEmailInput}
                        onChange={(event) => setApprovalEmailInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            addApproverFromInput();
                          }
                        }}
                        placeholder="approver@company.com"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
                      />
                      <button type="button" onClick={addApproverFromInput} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveSettings()}
                    disabled={savingSettings}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-500"
                  >
                    {savingSettings ? "Saving..." : "Save Approval Config"}
                  </button>
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">Sessions Edit</h4>
                  <button type="button" onClick={() => void loadSessionsData()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                    Refresh
                  </button>
                </div>
                {loadingSessions ? (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                    <span>Loading sessions...</span>
                  </div>
                ) : null}
                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                  {sessions.map((item) => (
                    <div key={item.user_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-600">{item.email}</p>
                          <p className="text-[11px] text-slate-500">
                            Last login: {item.last_login_at ? new Date(item.last_login_at).toLocaleString() : "Not active"} | {item.blocked ? "Blocked" : "Active"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              setSessionsStatus("Terminating session...");
                              try {
                                await updateSessionAction({ user_id: item.user_id, action: "terminate" });
                                setSessionsStatus("Session terminated.");
                                await loadSessionsData();
                              } catch (err) {
                                setSessionsStatus(err instanceof Error ? err.message : "Failed to terminate session.");
                              }
                            }}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                          >
                            Terminate
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const action = item.blocked ? "unblock" : "block";
                              setSessionsStatus(action === "block" ? "Blocking user..." : "Unblocking user...");
                              try {
                                await updateSessionAction({ user_id: item.user_id, action });
                                setSessionsStatus(action === "block" ? "User blocked." : "User unblocked.");
                                await loadSessionsData();
                              } catch (err) {
                                setSessionsStatus(err instanceof Error ? err.message : "Failed to update user permission.");
                              }
                            }}
                            disabled={Boolean(currentUser?.id && currentUser.id === item.user_id && !item.blocked)}
                            className={`rounded-lg border px-2 py-1 text-xs font-medium ${item.blocked ? "border-emerald-300 text-emerald-700" : "border-rose-300 text-rose-700"} disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {item.blocked ? "Unblock" : "Block"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sessions.length === 0 && !loadingSessions ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">No session records found.</p> : null}
                </div>
                {sessionsStatus ? <p className="mt-2 text-xs text-slate-600">{sessionsStatus}</p> : null}
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
