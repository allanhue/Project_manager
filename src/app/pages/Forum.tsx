"use client";

import { FormEvent, useEffect, useState } from "react";
import { createForumPost, ForumPost, listForumPosts } from "../auth/auth";
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
        <h2 className="text-lg font-semibold text-slate-900">Forum</h2>
        <p className="text-sm text-slate-600">Internal discussions, clarifications, and knowledge sharing.</p>
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
            <h3 className="text-sm font-semibold text-slate-900">{post.title}</h3>
            <p className="mt-2 text-sm text-slate-700">{post.body}</p>
            <p className="mt-2 text-xs text-slate-500">
              {post.author_email} • {new Date(post.created_at).toLocaleString()}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

