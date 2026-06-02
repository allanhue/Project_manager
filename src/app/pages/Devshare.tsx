"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CodeShare, createCodeShare, deleteCodeShare, listCodeShares, updateCodeShare } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

const languages = ["JavaScript", "TypeScript", "Python", "Java", "C#", "PHP", "Go", "Rust", "SQL", "HTML", "CSS", "Shell"];

function renderMarkdown(value: string) {
  const lines = value.trim().split(/\n+/g).filter(Boolean);
  if (lines.length === 0) return <p className="text-sm text-slate-500">Preview will appear here.</p>;

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        if (line.startsWith("### ")) return <h4 key={`${line}-${index}`} className="text-sm font-semibold text-slate-900">{line.slice(4)}</h4>;
        if (line.startsWith("## ")) return <h3 key={`${line}-${index}`} className="text-base font-semibold text-slate-900">{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h2 key={`${line}-${index}`} className="text-lg font-semibold text-slate-900">{line.slice(2)}</h2>;
        if (line.startsWith("- ")) return <p key={`${line}-${index}`} className="pl-3 text-sm text-slate-700">- {line.slice(2)}</p>;
        return <p key={`${line}-${index}`} className="text-sm leading-6 text-slate-700">{line}</p>;
      })}
    </div>
  );
}

type DevsharePageProps = {
  searchQuery?: string;
};

export default function DevsharePage({ searchQuery = "" }: DevsharePageProps) {
  const [shares, setShares] = useState<CodeShare[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [body, setBody] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const filteredShares = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return shares;
    return shares.filter((share) => `${share.title} ${share.language} ${share.body} ${share.code}`.toLowerCase().includes(query));
  }, [searchQuery, shares]);

  async function loadShares() {
    setLoading(true);
    setStatus("");
    try {
      const items = await listCodeShares();
      setShares(items);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load code shares.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShares();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setLanguage("TypeScript");
    setBody("");
    setCode("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !code.trim() || submitting) return;

    setSubmitting(true);
    setStatus(editingId !== null ? "Saving changes..." : "Posting code...");
    try {
      if (editingId !== null) {
        const updated = await updateCodeShare({
          id: editingId,
          title: title.trim(),
          body: body.trim(),
          language,
          code: code.trimEnd(),
        });
        setShares((prev) => prev.map((share) => (share.id === updated.id ? updated : share)));
        setStatus("Code share updated.");
        resetForm();
        return;
      }

      const created = await createCodeShare({
        title: title.trim(),
        body: body.trim(),
        language,
        code: code.trimEnd(),
      });
      setShares((prev) => [created, ...prev]);
      setStatus("Code share posted.");
      resetForm();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save code share.");
    } finally {
      setSubmitting(false);
    }
  }

  function onEdit(share: CodeShare) {
    setEditingId(share.id);
    setTitle(share.title);
    setLanguage(share.language);
    setBody(share.body);
    setCode(share.code);
    setStatus("");
  }

  async function onDelete(share: CodeShare) {
    if (!window.confirm(`Delete code share "${share.title}"?`)) return;
    setStatus("Deleting...");
    try {
      await deleteCodeShare(share.id);
      setShares((prev) => prev.filter((item) => item.id !== share.id));
      if (editingId === share.id) resetForm();
      setStatus("Code share deleted.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to delete code share.");
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dev Share</h2>
            <p className="text-sm text-slate-600">Share reusable snippets, implementation notes, and sample code with the team.</p>
          </div>
          <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{shares.length} snippet{shares.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_190px]">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Snippet title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
                required
              />
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-300"
              >
                {languages.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              placeholder="Markdown notes: # title, ## section, - bullet"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
            />
            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={12}
              spellCheck={false}
              placeholder="Paste sample code here..."
              className="w-full resize-y rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-sky-400"
              required
            />
          </div>

          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">{language}</span>
            </div>
            <article className="min-h-[120px] rounded-lg border border-slate-200 bg-white p-3">{renderMarkdown(body)}</article>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-sm leading-6 text-slate-100">
              <code>{code || "// Code preview"}</code>
            </pre>
          </aside>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {status ? <p className="text-sm text-slate-600">{status}</p> : <span />}
          <div className="flex justify-end gap-2">
            {editingId !== null ? (
              <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                Cancel
              </button>
            ) : null}
            <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {submitting ? "Saving..." : editingId !== null ? "Save Changes" : "Post Code"}
            </button>
          </div>
        </div>
      </form>

      {loading ? <LoadingSpinner label="Loading code shares..." /> : null}
      <div className="space-y-3">
        {filteredShares.map((share) => (
          <article key={share.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{share.title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{share.language}</span>
                </div>
                {share.body ? <div className="mt-2">{renderMarkdown(share.body)}</div> : null}
                <p className="mt-2 text-xs text-slate-500">
                  {share.updated_at ? "Updated" : "Posted"} by {share.author_email} on {new Date(share.updated_at || share.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => onEdit(share)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                  Edit
                </button>
                <button type="button" onClick={() => void onDelete(share)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                  Delete
                </button>
              </div>
            </div>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-sm leading-6 text-slate-100">
              <code>{share.code}</code>
            </pre>
          </article>
        ))}
        {!loading && filteredShares.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No code shares match your search.</p> : null}
      </div>
    </section>
  );
}
