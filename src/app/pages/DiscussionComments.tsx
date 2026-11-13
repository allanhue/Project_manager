"use client";

import { FormEvent, useEffect, useState } from "react";
import { createDiscussionComment, DiscussionComment, listDiscussionComments } from "../auth/auth";

export function DiscussionComments({ kind, id }: { kind: "issues" | "forum/posts"; id: number }) {
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => { let active = true; listDiscussionComments(kind, id).then((items) => { if (active) setComments(items); }).catch(() => { if (active) setStatus("Could not load comments."); }); return () => { active = false; }; }, [kind, id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!body.trim()) return;
    try { const item = await createDiscussionComment(kind, id, body.trim()); setComments((current) => [...current, item]); setBody(""); setStatus(""); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not add comment."); }
  }
  return <div className="mt-4 border-t border-slate-100 pt-3">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comments ({comments.length})</h4>
    <div className="mt-2 space-y-2">{comments.map((comment) => <div key={comment.id} className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-sm text-slate-700">{comment.body}</p><p className="mt-1 text-xs text-slate-500">{comment.author_email} · {new Date(comment.created_at).toLocaleString()}</p>
    </div>)}</div>
    <form onSubmit={submit} className="mt-3 flex gap-2"><input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a comment..." className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"/><button className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">Reply</button></form>
    {status ? <p className="mt-1 text-xs text-rose-600">{status}</p> : null}
  </div>;
}
