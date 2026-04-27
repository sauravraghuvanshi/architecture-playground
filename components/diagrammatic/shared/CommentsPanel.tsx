/**
 * CommentsPanel — local-first comment thread for the active diagram.
 *
 * Stored under `diagrammatic.comments.<scopeId>` in localStorage so it works
 * without an account and without a backend (the auth/comments API was removed
 * in commit 3ee1b43; a real backend is parked until Phase 6.5 / 8).
 *
 * scopeId: a stable per-diagram key. We use `mode:<diagramId|"draft">` so
 * each (mode, draft) pair has its own thread; once persisted diagrams come
 * back, callers should pass the diagram's GUID instead.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, Trash2, X } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  author: string;
  createdAt: number;
}

interface Props {
  scopeId: string;
  open: boolean;
  onClose: () => void;
}

const STORAGE_PREFIX = "diagrammatic.comments.";

function loadComments(scopeId: string): Comment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + scopeId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Comment[]) : [];
  } catch { return []; }
}

function saveComments(scopeId: string, list: Comment[]) {
  try { localStorage.setItem(STORAGE_PREFIX + scopeId, JSON.stringify(list)); } catch { /* ignore */ }
}

function loadAuthor(): string {
  if (typeof window === "undefined") return "You";
  try { return localStorage.getItem("diagrammatic.author") ?? "You"; } catch { return "You"; }
}

function saveAuthor(name: string) {
  try { localStorage.setItem("diagrammatic.author", name); } catch { /* ignore */ }
}

export function CommentsPanel({ scopeId, open, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState("You");

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComments(loadComments(scopeId));
    setAuthor(loadAuthor());
  }, [open, scopeId]);

  const sorted = useMemo(() => [...comments].sort((a, b) => b.createdAt - a.createdAt), [comments]);

  if (!open) return null;

  const addComment = () => {
    const body = draft.trim();
    if (!body) return;
    const next: Comment = {
      id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      body,
      author: author.trim() || "You",
      createdAt: Date.now(),
    };
    const list = [next, ...comments];
    setComments(list);
    saveComments(scopeId, list);
    saveAuthor(author);
    setDraft("");
  };

  const removeComment = (id: string) => {
    const list = comments.filter((c) => c.id !== id);
    setComments(list);
    saveComments(scopeId, list);
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
          <MessageSquare className="h-3.5 w-3.5" /> Comments
          {sorted.length > 0 && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">{sorted.length}</span>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close comments" className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {sorted.length === 0 ? (
          <p className="mt-6 text-center text-[11px] text-zinc-500">No comments yet.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((c) => (
              <li key={c.id} className="group rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-zinc-200">{c.author}</span>
                  <button type="button" onClick={() => removeComment(c.id)} aria-label="Delete comment" className="cursor-pointer text-zinc-600 opacity-0 transition group-hover:opacity-100 hover:text-rose-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-[12px] leading-snug text-zinc-300">{c.body}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{new Date(c.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-zinc-800 px-3 py-2">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name"
          className="mb-1.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <div className="flex items-end gap-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                addComment();
              }
            }}
            rows={2}
            placeholder="Add a comment… ⌘↵"
            className="flex-1 resize-none rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={addComment}
            disabled={!draft.trim()}
            aria-label="Send comment"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-lime-300 text-zinc-900 hover:bg-lime-200 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
