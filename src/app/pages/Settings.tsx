"use client";

import { FormEvent, useState } from "react";
import { sendSupportRequest } from "../auth/auth";

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
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

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
