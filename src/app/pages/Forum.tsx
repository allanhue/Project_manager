"use client";

import { FormEvent, useEffect, useState } from "react";
import { createForumPost, deleteForumPost, ForumPost, listForumPosts } from "../auth/auth";
import { LoadingSpinner } from "../componets/LoadingSpinner";

type ForumPageProps = {
  searchQuery?: string;
};

export default function ForumPage({ searchQuery = "" }: ForumPageProps) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");

  const [openMenuPostId, setOpenMenuPostId] = useState<number | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

  const [selectedPosts, setSelectedPosts] = useState<number[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const items = await listForumPosts();
        if (mounted) setPosts(items);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onDelete(post: ForumPost) {
    if (deletingPostId !== null) return;
    setOpenMenuPostId(null);
    if (!window.confirm(`Delete forum post "${post.title}"?`)) return;
    setStatus("Deleting...");
    setDeletingPostId(post.id);
    try {
      await deleteForumPost(post.id);
      setPosts((prev) => prev.filter((item) => item.id !== post.id));
      setStatus("Deleted.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to delete post.");
    } finally {
      setDeletingPostId(null);
    }
  }

  async function onBulkDelete() {
    if (selectedPosts.length === 0) return;
    if (!window.confirm(`Delete ${selectedPosts.length} selected post(s)?`)) return;
    setStatus("Deleting...");
    try {
      for (const id of selectedPosts) {
        await deleteForumPost(id);
      }
      setPosts((prev) => prev.filter((item) => !selectedPosts.includes(item.id)));
      setSelectedPosts([]);
      setStatus("Deleted.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to delete posts.");
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setStatus("Posting...");
    try {
      const post = await createForumPost({ title: title.trim(), body: body.trim() });
      setPosts((prev) => [post, ...prev]);
      setTitle("");
      setBody("");
      setStatus("Posted.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to post.");
    }
  }

  const filtered = posts.filter((p) => `${p.title} ${p.body} ${p.author_email}`.toLowerCase().includes(searchQuery.toLowerCase().trim()));

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Forum</h2>
            <p className="text-sm text-slate-600">Internal discussions, clarifications and knowledge sharing.</p>
          </div>
          {selectedPosts.length > 0 ? (
            <button
              type="button"
              onClick={() => void onBulkDelete()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
            >
              Delete Selected ({selectedPosts.length})
            </button>
          ) : null}
        </div>
      </header>
      <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Topic title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Start discussion..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          {status ? <p className="text-sm text-slate-600">{status}</p> : <span />}
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Post
          </button>
        </div>
      </form>

      {loading ? <LoadingSpinner label="Loading forum..." /> : null}
      <div className="space-y-3">
        {filtered.map((post) => (
          <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedPosts.includes(post.id)}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedPosts((prev) => [...prev, post.id]);
                    } else {
                      setSelectedPosts((prev) => prev.filter((id) => id !== post.id));
                    }
                  }}
                  className="mt-1 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">{post.title}</h3>
                  <p className="mt-2 text-sm text-slate-700">{post.body}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {post.author_email} • {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="relative ml-4">
                <button
                  type="button"
                  onClick={() => setOpenMenuPostId((prev) => (prev === post.id ? null : post.id))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                  aria-label={`Open actions for post ${post.id}`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
                {openMenuPostId === post.id ? (
                  <div className="absolute right-0 top-10 z-10 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => void onDelete(post)}
                      disabled={deletingPostId === post.id}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingPostId === post.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

