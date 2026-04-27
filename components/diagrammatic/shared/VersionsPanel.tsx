/**
 * VersionsPanel — local-first version history for the active diagram.
 *
 * Each entry stores a deep copy of the mode payload at snapshot time. Caller
 * provides:
 *   - getCurrent: () => unknown — capture current canvas state
 *   - onRestore: (payload) => void — hydrate canvas from a snapshot
 *
 * Storage key: `diagrammatic.versions.<scopeId>`. Entries are pruned to the
 * last `MAX` (32) by default to bound localStorage usage.
 */
"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, Trash2, X, CirclePlus } from "lucide-react";

interface Version {
  id: string;
  label: string;
  payload: unknown;
  createdAt: number;
}

interface Props {
  scopeId: string;
  open: boolean;
  onClose: () => void;
  getCurrent: () => unknown;
  onRestore: (payload: unknown) => void;
}

const STORAGE_PREFIX = "diagrammatic.versions.";
const MAX = 32;

function load(scopeId: string): Version[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + scopeId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Version[]) : [];
  } catch { return []; }
}

function save(scopeId: string, list: Version[]) {
  try { localStorage.setItem(STORAGE_PREFIX + scopeId, JSON.stringify(list)); } catch { /* ignore — quota */ }
}

export function VersionsPanel({ scopeId, open, onClose, getCurrent, onRestore }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    setVersions(load(scopeId));
  }, [open, scopeId]);

  if (!open) return null;

  const snapshot = () => {
    const payload = getCurrent();
    const v: Version = {
      id: `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim() || `Snapshot ${new Date().toLocaleString()}`,
      payload: JSON.parse(JSON.stringify(payload)),
      createdAt: Date.now(),
    };
    const list = [v, ...versions].slice(0, MAX);
    setVersions(list);
    save(scopeId, list);
    setLabel("");
  };

  const restore = (v: Version) => {
    if (!confirm(`Restore "${v.label}"? Current canvas will be replaced.`)) return;
    onRestore(JSON.parse(JSON.stringify(v.payload)));
  };

  const remove = (id: string) => {
    const list = versions.filter((v) => v.id !== id);
    setVersions(list);
    save(scopeId, list);
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
          <History className="h-3.5 w-3.5" /> Versions
          {versions.length > 0 && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">{versions.length}</span>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close versions" className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="border-b border-zinc-800 px-3 py-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Snapshot label (optional)"
          className="mb-1.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={snapshot}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-lime-300 px-2 py-1.5 text-[11px] font-semibold text-zinc-900 hover:bg-lime-200"
        >
          <CirclePlus className="h-3.5 w-3.5" />
          Save snapshot
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {versions.length === 0 ? (
          <p className="mt-6 text-center text-[11px] text-zinc-500">No snapshots yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {versions.map((v) => (
              <li key={v.id} className="group rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-zinc-100">{v.label}</p>
                    <p className="text-[10px] text-zinc-500">{new Date(v.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button type="button" onClick={() => restore(v)} aria-label="Restore version" title="Restore" className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-300">
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => remove(v.id)} aria-label="Delete version" title="Delete" className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
