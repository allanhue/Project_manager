"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApprovalRequest, createApprovalRequest, getUserSettings, listApprovalRequests, listProjects, Project, UserSettings } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

type ApprovalsPageProps = {
  searchQuery?: string;
};

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

export default function ApprovalsPage({ searchQuery = "" }: ApprovalsPageProps) {
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [projectID, setProjectID] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [approvalItems, projectItems, userSettings] = await Promise.all([listApprovalRequests(), listProjects(), getUserSettings()]);
      setItems(approvalItems);
      setProjects(projectItems);
      setSettings({ ...defaultSettings, ...userSettings });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.project_name} ${item.status} ${item.note} ${item.requested_by_email} ${item.approval_mode}`.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const summary = useMemo(() => {
    const pending = filteredItems.filter((item) => item.status === "pending").length;
    const approved = filteredItems.filter((item) => item.status === "approved").length;
    const rejected = filteredItems.filter((item) => item.status === "rejected").length;
    return { pending, approved, rejected };
  }, [filteredItems]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Submitting approval request...");
    try {
      await createApprovalRequest({
        project_id: projectID ? Number(projectID) : null,
        note: note.trim(),
        hours: hours.trim() ? Number(hours) : 0,
      });
      setProjectID("");
      setHours("");
      setNote("");
      setStatus("Approval request submitted and notifications sent.");
      await loadData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to submit approval request.");
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Approvals</h2>
        <p className="text-sm text-slate-600">Approval workflow for billable projects and timesheet-related delivery checks. Approvals are processed via email links only.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pipeline Mode</p>
          <p className="text-xl font-semibold text-slate-900">{settings.approval_pipeline === "multi_approval" ? "Multi Approval" : "Simple"}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending</p>
          <p className="text-2xl font-semibold text-amber-700">{summary.pending}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Approved</p>
          <p className="text-2xl font-semibold text-emerald-700">{summary.approved}</p>
        </article>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <LoadingSpinner label="Loading approvals..." /> : null}

      <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Create Approval Request</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={projectID} onChange={(event) => setProjectID(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none">
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step={0.25}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            placeholder="Billable hours (optional)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Submit Request
          </button>
        </div>
        <textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Approval note for reviewers and finance."
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
        />
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Hours</th>
                <th className="px-2 py-2 font-medium">Pipeline</th>
                <th className="px-2 py-2 font-medium">Approvals</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Requested By</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-2 py-3 text-slate-900">{item.project_name || "-"}</td>
                  <td className="px-2 py-3 text-slate-700">{item.billable_hours.toFixed(2)}</td>
                  <td className="px-2 py-3 text-slate-700">{item.approval_mode === "multi_approval" ? "Multi Approval" : "Simple"}</td>
                  <td className="px-2 py-3 text-slate-700">
                    {item.approvals.length}/{item.required_approvals}
                  </td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === "approved" ? "bg-emerald-50 text-emerald-700" : item.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{item.requested_by_email}</td>
                  <td className="px-2 py-3 text-slate-600">Mail-only approval</td>
                </tr>
              ))}
              {filteredItems.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={7}>
                    No approval requests yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
    </section>
  );
}
