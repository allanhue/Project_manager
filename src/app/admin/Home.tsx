"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSystemLogs, sendTestNotification, SystemLog } from "../auth/auth";

export default function SystemSupportPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [error, setError] = useState("");
  const [mailStatus, setMailStatus] = useState("");
  const [showMailModal, setShowMailModal] = useState(false);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("System support notification");
  const [message, setMessage] = useState("Hello, this is a support notification from system administration.");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const systemLogs = await getSystemLogs(120);
        if (!mounted) return;
        setLogs(systemLogs);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load support logs.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setMailStatus("Sending...");
      await sendTestNotification({ email, subject, message });
      setMailStatus("Support email sent.");
      setShowMailModal(false);
    } catch (err) {
      setMailStatus(err instanceof Error ? err.message : "Failed to send support email.");
    }
  }

  const errorCount = logs.filter((item) => item.status_code >= 500).length;
  const warnCount = logs.filter((item) => item.status_code >= 400 && item.status_code < 500).length;
  const avgLatency = logs.length > 0 ? Math.round(logs.reduce((sum, item) => sum + item.latency_ms, 0) / logs.length) : 0;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Technical Support Center</h2>
        <p className="text-sm text-slate-600">Debug user issues, inspect API activity logs, and send support communication.</p>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Server Errors</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{errorCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Client Errors</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{warnCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Avg Latency</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{avgLatency} ms</p>
        </article>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Support Notifications</h3>
        <button
          type="button"
          onClick={() => setShowMailModal(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Compose Support Email
        </button>
        {mailStatus ? <p className="mt-2 text-sm text-slate-600">{mailStatus}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Debug Logs</h3>
          <button
            type="button"
            onClick={async () => {
              try {
                const systemLogs = await getSystemLogs(120);
                setLogs(systemLogs);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to refresh logs.");
              }
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Time</th>
                <th className="px-2 py-2 font-medium">Tenant</th>
                <th className="px-2 py-2 font-medium">User</th>
                <th className="px-2 py-2 font-medium">Method</th>
                <th className="px-2 py-2 font-medium">Path</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Latency</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100">
                  <td className="px-2 py-3 text-slate-700">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-2 py-3 text-slate-700">{log.tenant_slug || "-"}</td>
                  <td className="px-2 py-3 text-slate-700">{log.user_email || "-"}</td>
                  <td className="px-2 py-3">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{log.method}</span>
                  </td>
                  <td className="px-2 py-3 font-mono text-xs text-slate-700">{log.path}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        log.status_code >= 500
                          ? "bg-rose-50 text-rose-700"
                          : log.status_code >= 400
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {log.status_code}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{log.latency_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showMailModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={onSend} className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Send Support Email</h3>
            <p className="mt-1 text-sm text-slate-600">Send a direct support notification to an organization administrator.</p>
            <div className="mt-4 grid gap-3">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Recipient email (optional)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
              <input
                type="text"
                required
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
              <textarea
                required
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Message body"
                className="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMailModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
