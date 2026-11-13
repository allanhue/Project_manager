"use client";

import { FormEvent, useEffect, useState } from "react";
import { createIssue, IssueItem, listIssues, listProjects, Project } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";
import { DiscussionComments } from "./DiscussionComments";

type IssuesPageProps = {
  searchQuery?: string;
};

export default function IssuesPage({ searchQuery = "" }: IssuesPageProps) {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [projectID, setProjectID] = useState("");
  const [status, setStatus] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [items, projectItems] = await Promise.all([listIssues(), listProjects()]);
        if (mounted) {
          setIssues(items);
          setProjects(projectItems);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setStatus("Saving...");
    try {
      const issue = await createIssue({
        project_id: projectID ? Number(projectID) : null,
        title: title.trim(),
        description: description.trim(),
        severity,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      setIssues((prev) => [issue, ...prev]);
      setTitle("");
      setDescription("");
      setSeverity("medium");
      setProjectID("");
      setTags("");
      setStatus("Issue created.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create issue.");
    }
  }

  const filtered = issues.filter((i) => `${i.title} ${i.description} ${i.project_name || ""}`.toLowerCase().includes(searchQuery.toLowerCase().trim()));

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Issues</h2>
        <p className="text-sm text-slate-600">Track project blockers and operational issues in one place.</p>
      </header>
      <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <select value={projectID} onChange={(e) => setProjectID(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">No project link</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Issue title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated, e.g. bug, urgent)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe issue..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          {status ? <p className="text-sm text-slate-600">{status}</p> : <span />}
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Add Issue
          </button>
        </div>
      </form>
      {loading ? <LoadingSpinner label="Loading issues..." /> : null}
      <div className="space-y-3">
        {filtered.map((issue) => (
          <article key={issue.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{issue.title}</h3>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{issue.severity}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{issue.description}</p>
            {issue.tags?.length ? <div className="mt-2 flex flex-wrap gap-2">{issue.tags.map((tag) => <span key={tag} className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">#{tag}</span>)}</div> : null}
            <p className="mt-2 text-xs text-slate-500">
              {issue.project_name ? `Project: ${issue.project_name} • ` : ""}
              {new Date(issue.created_at).toLocaleString()}
            </p>
            <DiscussionComments kind="issues" id={issue.id} />
          </article>
        ))}
      </div>
    </section>
  );
}

