"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { actionApprovalRequest, ApprovalRequest, createApprovalRequest, deleteApprovalRequest, getUserSettings, listApprovalRequests, listProjects, Project, UserSettings } from "../auth/auth";
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
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [actingKey, setActingKey] = useState<string>("");
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);

  const [projectID, setProjectID] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");

  const [openMenuApprovalId, setOpenMenuApprovalId] = useState<number | null>(null);
  const [deletingApprovalId, setDeletingApprovalId] = useState<number | null>(null);

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
    return items.filter((item) =>
      `${item.project_name} ${item.status} ${item.note} ${item.requested_by_email} ${item.approval_mode} ${(item.approver_emails || []).join(" ")} ${(item.approvals || []).join(" ")} ${item.current_step || 0}`
        .toLowerCase()
        .includes(q),
    );
  }, [items, searchQuery]);

  const pendingFiltered = useMemo(() => filteredItems.filter((item) => item.status === "pending"), [filteredItems]);
  const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every((item) => selectedIDs.includes(item.id));

  const summary = useMemo(() => {
    const pending = filteredItems.filter((item) => item.status === "pending").length;
    const approved = filteredItems.filter((item) => item.status === "approved").length;
    const rejected = filteredItems.filter((item) => item.status === "rejected").length;
    return { pending, approved, rejected };
  }, [filteredItems]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRequest) return;
    setSubmittingRequest(true);
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
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function onAction(id: number, action: "approve" | "reject") {
    if (actingKey) return;
    setActingKey(`${action}-${id}`);
    setStatus(action === "approve" ? "Approving request..." : "Rejecting request...");
    try {
      await actionApprovalRequest({ id, action });
      setStatus(action === "approve" ? "Request approved." : "Request rejected.");
      setSelectedIDs((prev) => prev.filter((entry) => entry !== id));
      await loadData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to update approval request.");
    } finally {
      setActingKey("");
    }
  }

  async function onBulkAction(action: "approve" | "reject") {
    const targets = pendingFiltered.filter((item) => selectedIDs.includes(item.id)).map((item) => item.id);
    if (targets.length === 0 || actingKey) return;
    setActingKey(`bulk-${action}`);
    setStatus(action === "approve" ? `Approving ${targets.length} request(s)...` : `Rejecting ${targets.length} request(s)...`);
    try {
      for (const id of targets) {
        await actionApprovalRequest({ id, action });
      }
      setStatus(action === "approve" ? "Bulk approval completed." : "Bulk rejection completed.");
      setSelectedIDs([]);
      await loadData();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setActingKey("");
    }
  }

  async function onDelete(request: ApprovalRequest) {
    if (deletingApprovalId !== null) return;
    setOpenMenuApprovalId(null);
    if (!window.confirm(`Delete approval request "${request.note}"?`)) return;
    setError("");
    setDeletingApprovalId(request.id);
    try {
      await deleteApprovalRequest(request.id);
      setItems((prev) => prev.filter((item) => item.id !== request.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete approval request.");
    } finally {
      setDeletingApprovalId(null);
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Approvals</h2>
            <p className="text-sm text-slate-600">Approval workflow for billable projects and timesheet-related delivery checks.</p>
          </div>
        </div>
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
      <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Configured Approver Flow</p>
        {settings.approval_approvers.length === 0 ? <p className="mt-2 text-sm text-slate-500">No approver emails configured in Advanced Settings.</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {settings.approval_approvers.map((email, index) => (
            <span key={`approver-flow-${email}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {settings.approval_pipeline === "multi_approval" ? `${index + 1}. ` : ""}{email}
            </span>
          ))}
        </div>
      </article>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <LoadingSpinner label="Loading approvals..." /> : null}

      <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Create Approval Request</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label htmlFor="approval-project" className="sr-only">
            Project
          </label>
          <select
            id="approval-project"
            value={projectID}
            onChange={(event) => setProjectID(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
          >
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
          <button
            type="submit"
            disabled={submittingRequest}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {submittingRequest ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : null}
            {submittingRequest ? "Submitting..." : "Submit Request"}
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIDs(allPendingSelected ? [] : pendingFiltered.map((item) => item.id))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {allPendingSelected ? "Unselect Pending" : "Select Pending"}
            </button>
            <span className="text-xs text-slate-500">{selectedIDs.length} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onBulkAction("approve")}
              disabled={selectedIDs.length === 0 || !!actingKey}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actingKey === "bulk-approve" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700" /> : null}
              Bulk Approve
            </button>
            <button
              type="button"
              onClick={() => void onBulkAction("reject")}
              disabled={selectedIDs.length === 0 || !!actingKey}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actingKey === "bulk-reject" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-300 border-t-rose-700" /> : null}
              Bulk Reject
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Hours</th>
                <th className="px-2 py-2 font-medium">Pipeline</th>
                <th className="px-2 py-2 font-medium">Approver Flow</th>
                <th className="px-2 py-2 font-medium">Approvals</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Requested By</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select approval ${item.id} for bulk action`}
                      checked={selectedIDs.includes(item.id)}
                      disabled={item.status !== "pending" || !!actingKey}
                      onChange={(event) =>
                        setSelectedIDs((prev) => (event.target.checked ? [...prev, item.id] : prev.filter((entry) => entry !== item.id)))
                      }
                    />
                  </td>
                  <td className="px-2 py-3 text-slate-900">{item.project_name || "-"}</td>
                  <td className="px-2 py-3 text-slate-700">{item.billable_hours.toFixed(2)}</td>
                  <td className="px-2 py-3 text-slate-700">{item.approval_mode === "multi_approval" ? "Multi Approval" : "Simple"}</td>
                  <td className="px-2 py-3 text-slate-700">{(item.approver_emails || []).join(" -> ") || "-"}</td>
                  <td className="px-2 py-3 text-slate-700">
                    {item.approvals.length}/{item.required_approvals} {item.status === "pending" ? `(step ${(item.current_step || 0) + 1})` : ""}
                  </td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === "approved" ? "bg-emerald-50 text-emerald-700" : item.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{item.requested_by_email}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onAction(item.id, "approve")}
                        disabled={item.status !== "pending" || !!actingKey}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actingKey === `approve-${item.id}` ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700" /> : null}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void onAction(item.id, "reject")}
                        disabled={item.status !== "pending" || !!actingKey}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actingKey === `reject-${item.id}` ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-300 border-t-rose-700" /> : null}
                        Reject
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuApprovalId((prev) => (prev === item.id ? null : item.id))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                          aria-label={`Open actions for approval ${item.id}`}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>
                        {openMenuApprovalId === item.id ? (
                          <div className="absolute right-0 top-10 z-10 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => void onDelete(item)}
                              disabled={deletingApprovalId === item.id}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingApprovalId === item.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={9}>
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
