"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, FilePlus2, FolderOpen, Loader2, Pencil, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import {
  deleteDiagram, filterDiagramSummaries, listDiagrams, loadDiagram, normalizeDiagramName,
  renameDiagram, summarizeDiagram, type DiagramRecord, type DiagramSummary,
} from "@/lib/diagram-library";
import { MODE_META, type DiagrammaticMode } from "./types";
import { useDialogFocus } from "./useDialogFocus";

const modes = Object.keys(MODE_META) as DiagrammaticMode[];

export interface DiagramLibraryModalProps {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Return false if the user cancels switching away from an unsaved canvas. */
  onOpen: (record: DiagramRecord) => void | boolean | Promise<void | boolean>;
  /** Capture and persist the current canvas; the parent owns active identity. */
  onSave: (name: string) => Promise<void>;
  /** Create, save, and activate a blank document of the selected mode. */
  onNew: (mode: DiagrammaticMode, name: string) => Promise<void>;
  currentName?: string;
  currentDocumentId?: string;
  currentMode?: DiagrammaticMode;
  onRenamed?: (record: DiagramRecord) => void;
  onDeleted?: (id: string) => void;
}

export default function DiagramLibraryModal(props: DiagramLibraryModalProps) {
  return props.open && typeof document !== "undefined" ? <LibraryDialog {...props} /> : null;
}

function LibraryDialog({
  onClose, onOpen, onSave, onNew, currentName = "", currentDocumentId, currentMode = "architecture",
  onRenamed, onDeleted, returnFocusRef,
}: DiagramLibraryModalProps) {
  const [records, setRecords] = useState<DiagramSummary[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState(currentName);
  const [newMode, setNewMode] = useState<DiagrammaticMode>(currentMode);
  const [busy, setBusy] = useState<string | null>("Loading library");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleting, setDeleting] = useState<DiagramSummary | null>(null);
  const mounted = useRef(true);
  const pending = useRef(true);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useDialogFocus({ open: true, onClose: close, initialFocusRef: closeButton, returnFocusRef, canClose: () => !pending.current });

  useEffect(() => {
    mounted.current = true;
    let active = true;
    listDiagrams().then((items) => {
      if (active) setRecords(items);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "The diagram library could not be loaded.");
    }).finally(() => {
      if (active) { pending.current = false; setBusy(null); }
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  const visible = useMemo(() => filterDiagramSummaries(records, query), [records, query]);

  async function refresh() {
    const items = await listDiagrams();
    if (mounted.current) setRecords(items);
  }

  async function perform(label: string, action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "The library operation failed. Please retry.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function close() {
    if (!pending.current) onClose();
  }

  async function saveCurrent() {
    const savedName = normalizeDiagramName(name);
    await onSave(savedName);
    if (!mounted.current) return;
    setQuery("");
    setNotice(`Saved "${savedName}" in this browser.`);
    await refresh();
  }

  async function createNew() {
    await onNew(newMode, normalizeDiagramName(name));
    if (mounted.current) onClose();
  }

  async function openRecord(id: string) {
    const record = await loadDiagram(id);
    if (!mounted.current) return;
    const switched = await onOpen(record);
    if (mounted.current && switched !== false) onClose();
  }

  async function commitRename(record: DiagramSummary) {
    const updated = await renameDiagram(record.id, renameName, record.revision);
    const summary = summarizeDiagram(updated);
    if (mounted.current) {
      setRenaming(null);
      setNotice(`Renamed diagram to "${updated.name}".`);
      setRecords((previous) => previous.map((item) => item.id === updated.id ? summary : item));
    }
    onRenamed?.(updated);
  }

  async function confirmDelete(record: DiagramSummary) {
    await deleteDiagram(record.id, record.revision);
    if (mounted.current) {
      setDeleting(null);
      setNotice(`Deleted "${record.name}" from this browser.`);
      setRecords((previous) => previous.filter((item) => item.id !== record.id));
    }
    onDeleted?.(record.id);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="diagram-library-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0b1424] text-slate-100 shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-white/10 p-5">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">Diagrammatic / Local collection</p>
            <h2 id="diagram-library-title" className="flex items-center gap-2 text-xl font-semibold"><FolderOpen size={21} className="text-cyan-300" />Saved diagrams</h2>
          </div>
          <button ref={closeButton} type="button" onClick={close} disabled={Boolean(busy)} aria-label="Close diagram library" className="rounded p-2 text-slate-400 hover:bg-white/10 disabled:opacity-40"><X size={18} /></button>
        </header>
        <div className="min-h-0 overflow-y-auto">
          <div className="space-y-4 border-b border-white/10 p-5">
            <p className="text-xs leading-relaxed text-slate-400">Saved only in this browser and on this device using IndexedDB. No account sync or cloud backup. Clearing site data or using private browsing can remove this library. Existing drafts are recovered without deleting their original data.</p>
            <label className="block text-xs font-medium text-slate-300">Name for saved or new diagram
              <input aria-label="Diagram name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} disabled={Boolean(busy)} placeholder="e.g. Customer workshop - baseline" className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-cyan-300/60 disabled:opacity-50" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={() => void perform("Saving current diagram", saveCurrent)} className="flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"><Save size={14} />Save current diagram</button>
              <span className="mx-1 text-xs text-slate-600">or</span>
              <select aria-label="New diagram mode" disabled={Boolean(busy)} value={newMode} onChange={(event) => {
                const selected = modes.find((key) => key === event.target.value);
                if (selected) setNewMode(selected);
                else setError("Select a supported diagram mode.");
              }} className="rounded-lg border border-white/15 bg-[#101d30] px-2 py-2 text-xs">
                {modes.map((key) => <option key={key} value={key}>{MODE_META[key].label}</option>)}
              </select>
              <button type="button" disabled={Boolean(busy)} onClick={() => void perform("Creating diagram", createNew)} className="flex items-center gap-2 rounded-lg border border-cyan-300/25 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-40"><FilePlus2 size={14} />Create blank diagram</button>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-400">
                <Search size={15} /><input type="search" aria-label="Search saved diagrams" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or mode" className="w-full bg-transparent text-sm text-slate-200 outline-none" />
              </label>
              <button type="button" onClick={() => void perform("Refreshing library", refresh)} disabled={Boolean(busy)} aria-label="Refresh diagram library" className="rounded-lg border border-white/10 p-2.5 text-slate-400 hover:text-cyan-200 disabled:opacity-40"><RefreshCw size={16} /></button>
            </div>
            {busy && <p role="status" className="flex items-center gap-2 text-xs text-cyan-200"><Loader2 size={14} className="animate-spin" />{busy}...</p>}
            {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
            {notice && <p role="status" className="text-xs text-cyan-200">{notice}</p>}
            {!busy && !error && visible.length === 0 && <div className="rounded-xl border border-dashed border-white/15 px-4 py-9 text-center">
              <p className="text-sm text-slate-300">{records.length ? "No diagrams match your search." : "Your local collection starts here."}</p>
              <p className="mt-1 text-xs text-slate-500">{records.length ? "Try a different name or mode." : "Save the current canvas or create a named blank diagram above."}</p>
            </div>}
            <ul aria-label="Saved diagrams" className="space-y-2">
              {visible.map((record) => <li key={record.id} className={`rounded-xl border p-3 ${record.id === currentDocumentId ? "border-cyan-300/35 bg-cyan-300/5" : "border-white/10 bg-black/10"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {renaming === record.id ? <label className="block">
                      <span className="sr-only">New name for {record.name}</span>
                      <input autoFocus value={renameName} maxLength={200} disabled={Boolean(busy)} onChange={(event) => setRenameName(event.target.value)} onKeyDown={(event) => {
                        if (event.key === "Enter") { event.preventDefault(); void perform("Renaming diagram", () => commitRename(record)); }
                        if (event.key === "Escape") { event.stopPropagation(); setRenaming(null); }
                      }} className="w-full rounded border border-cyan-300/40 bg-black/30 px-2 py-1 text-sm outline-none" />
                    </label> : <h3 className="truncate text-sm font-semibold" title={record.name}>{record.name}</h3>}
                    <p className="mt-1 text-[11px] text-slate-400">{MODE_META[record.mode].label} <span className="px-1 text-slate-600">/</span> {new Date(record.updatedAt).toLocaleString()} <span className="px-1 text-slate-600">/</span> {record.versionCount} snapshots, {record.commentCount} comments</p>
                    {record.id === currentDocumentId && <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">Active document</span>}
                  </div>
                  {renaming === record.id ? <>
                    <button type="button" disabled={Boolean(busy)} aria-label={`Save name for ${record.name}`} onClick={() => void perform("Renaming diagram", () => commitRename(record))} className="rounded p-2 text-cyan-300 hover:bg-white/10 disabled:opacity-40"><Check size={16} /></button>
                    <button type="button" disabled={Boolean(busy)} aria-label="Cancel rename" onClick={() => setRenaming(null)} className="rounded p-2 text-slate-400 hover:bg-white/10"><X size={16} /></button>
                  </> : <>
                    <button type="button" disabled={Boolean(busy)} onClick={() => void perform("Opening diagram", () => openRecord(record.id))} aria-label={`Open diagram ${record.name}`} className="rounded-lg border border-cyan-300/25 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-40">Open</button>
                    <button type="button" disabled={Boolean(busy)} aria-label={`Rename diagram ${record.name}`} onClick={() => { setRenaming(record.id); setRenameName(record.name); setDeleting(null); }} className="rounded p-2 text-slate-400 hover:bg-white/10"><Pencil size={15} /></button>
                    <button type="button" disabled={Boolean(busy)} aria-label={`Delete diagram ${record.name}`} onClick={() => { setDeleting(record); setRenaming(null); }} className="rounded p-2 text-slate-400 hover:bg-red-400/10 hover:text-red-200"><Trash2 size={15} /></button>
                  </>}
                </div>
                {deleting?.id === record.id && <div role="group" aria-label="Confirm diagram deletion" className="mt-3 rounded-lg border border-red-400/25 bg-red-400/5 p-3">
                  <p className="text-xs text-red-200">Permanently delete &quot;{record.name}&quot; and its saved comments and snapshots from this browser? This cannot be undone. The current canvas is not cleared.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={Boolean(busy)} onClick={() => void perform("Deleting diagram", () => confirmDelete(record))} className="rounded bg-red-300 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40">Confirm delete</button>
                    <button type="button" disabled={Boolean(busy)} onClick={() => setDeleting(null)} className="rounded px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">Keep diagram</button>
                  </div>
                </div>}
              </li>)}
            </ul>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3 text-[11px] text-slate-500"><span>{records.length} saved {records.length === 1 ? "diagram" : "diagrams"}</span><span>Browser-local storage</span></footer>
      </div>
    </div>,
    document.body
  );
}
