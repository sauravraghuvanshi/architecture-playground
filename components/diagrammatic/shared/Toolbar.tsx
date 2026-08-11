/**
 * Toolbar — workspace top bar.
 *
 * Hosts: title, undo/redo, fit, delete, animate-flows toggle, save.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Undo2, Redo2, Maximize2, Trash2, Activity, Save, Loader2, Check, LayoutGrid, Play, Square, ChevronDown, Download, FolderOpen, Sparkles, MessageSquare, History, CloudCog, Home, FilePlus2 } from "lucide-react";

const TIERS = ["Edge", "Frontend", "Gateway", "Compute", "Messaging", "Data", "Ops", "Custom"] as const;
const EXPORT_FORMATS = [
  { id: "png" as const, label: "PNG · high resolution" },
  { id: "svg" as const, label: "SVG · editable vector" },
  { id: "pdf" as const, label: "PDF · presentation ready" },
  { id: "gif" as const, label: "GIF · ordered request flow" },
  { id: "json" as const, label: "JSON · re-importable" },
];
export type ExportFormat = string;

interface Props {
  title: string;
  onFit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSave?: () => void;
  /** Cycle every edge in the graph through solid → dashed → flow. */
  onCycleEdgeStyle?: () => void;
  /** Current global edge style (informational — affects the icon highlight). */
  edgeStyle?: "solid" | "dashed" | "flow";
  /** Add a new group/swimlane node at the canvas center. */
  onAddTier?: (tier: string) => void;
  /** Start sequence playback. */
  onPlay?: () => void;
  /** Stop sequence playback. */
  onStop?: () => void;
  /** Whether the sequence playback is currently active. */
  playing?: boolean;
  /** Trigger an export of the canvas. */
  onExport?: (format: ExportFormat) => void;
  /** Mode-specific extra export formats (SQL DDL, TypeScript, Markdown, …). */
  extraExports?: Array<{ id: string; label: string }>;
  /** Hide the default raster (PNG/SVG/GIF) export entries — used for modes
   *  whose visuals don't make sense as PNG/GIF (e.g. textual exports only). */
  hideRasterExports?: boolean;
  /** Hide ordered GIF export for modes without a sequence capture driver. */
  hideGifExport?: boolean;
  /** Mode-specific starter templates. When provided, renders a Templates
   *  dropdown that calls onApplyTemplate(id) on selection. */
  templates?: Array<{ id: string; name: string; description?: string }>;
  onApplyTemplate?: (id: string) => void;
  /** Replace the current mode payload with its structurally-valid blank state. */
  onBlankCanvas?: () => void;
  /** Open the AI prompt modal (Phase 5 — per-mode generate). */
  onAiAssist?: () => void;
  /** Disables the AI button + shows a tooltip when AI env vars are absent. */
  aiDisabledReason?: string;
  /** Toggle the right-rail comments panel. */
  onToggleComments?: () => void;
  commentsOpen?: boolean;
  /** Toggle the right-rail versions panel. */
  onToggleVersions?: () => void;
  versionsOpen?: boolean;
  saving?: boolean;
  saved?: boolean;
}

export function Toolbar({
  title,
  onFit,
  onUndo,
  onRedo,
  onDelete,
  onSave,
  onCycleEdgeStyle,
  edgeStyle = "solid",
  onAddTier,
  onPlay,
  onStop,
  playing,
  onExport,
  extraExports,
  hideRasterExports,
  hideGifExport,
  templates,
  onApplyTemplate,
  onBlankCanvas,
  onAiAssist,
  aiDisabledReason,
  onToggleComments,
  commentsOpen,
  onToggleVersions,
  versionsOpen,
  saving,
  saved,
}: Props) {
  const [tierMenuOpen, setTierMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-[#08111f] px-3 text-sm text-slate-200 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:bg-cyan-300"
          aria-label="Back to project hub"
        >
          <CloudCog className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
            <Home className="h-2.5 w-2.5" />
            Diagrammatic / Studio
          </div>
          <span className="block truncate text-xs font-semibold text-white sm:text-sm">{title}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-800 bg-slate-950/60 p-0.5">
        <ToolButton onClick={onUndo} title="Undo (Ctrl+Z)" Icon={Undo2} />
        <ToolButton onClick={onRedo} title="Redo (Ctrl+Y)" Icon={Redo2} />
        <ToolButton onClick={onFit} title="Fit view (Ctrl+0)" Icon={Maximize2} />
        <ToolButton onClick={onDelete} title="Delete selection (Del)" Icon={Trash2} />
        </div>
        {onAddTier && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setTierMenuOpen((o) => !o)}
              onBlur={() => setTimeout(() => setTierMenuOpen(false), 150)}
              title="Add tier / swimlane group"
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Tier
              <ChevronDown className="h-3 w-3" />
            </button>
            {tierMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-36 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-2xl">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAddTier(t);
                      setTierMenuOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {(onPlay || onStop) && (
          <button
            type="button"
            onClick={() => (playing ? onStop?.() : onPlay?.())}
            title={playing ? "Stop sequence" : "Play sequence (animate request flow)"}
            className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-wide transition ${
              playing
                ? "bg-rose-400 text-slate-950 hover:bg-rose-300"
                : "border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
            }`}
          >
            {playing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Stop" : "Play"}
          </button>
        )}
        {onCycleEdgeStyle && (
          <button
            type="button"
            onClick={onCycleEdgeStyle}
            title={`Edge style: ${edgeStyle} — click to cycle (solid → dashed → flow)`}
            className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-wide transition ${
              edgeStyle === "flow"
                ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            {edgeStyle}
          </button>
        )}
        {onAiAssist && (
          <button
            type="button"
            onClick={onAiAssist}
            disabled={!!aiDisabledReason}
            title={aiDisabledReason ?? "Generate from a prompt with AI"}
            aria-label="AI Assist"
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-400/10 px-2 py-1.5 text-[10px] font-semibold text-sky-200 transition hover:bg-sky-400/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI
          </button>
        )}
        {onBlankCanvas && (
          <button
            type="button"
            onClick={onBlankCanvas}
            title="Start with a blank canvas"
            aria-label="Start with blank canvas"
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Blank
          </button>
        )}
        {templates && templates.length > 0 && onApplyTemplate && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplatesOpen((o) => !o)}
              onBlur={() => setTimeout(() => setTemplatesOpen(false), 150)}
              title="Load a starter template"
              aria-label="Templates"
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Templates
              <ChevronDown className="h-3 w-3" />
            </button>
            {templatesOpen && (
              <div className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-2xl">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onApplyTemplate(t.id);
                      setTemplatesOpen(false);
                    }}
                    className="flex w-full cursor-pointer flex-col items-start px-2.5 py-1.5 text-left hover:bg-zinc-800"
                  >
                    <span className="text-[11px] font-semibold text-zinc-100">{t.name}</span>
                    {t.description && (
                      <span className="text-[10px] text-zinc-400">{t.description}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {onExport && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((o) => !o)}
              onBlur={() => setTimeout(() => setExportMenuOpen(false), 150)}
              title="Export the canvas"
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-cyan-500/50 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronDown className="h-3 w-3" />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-2xl">
                {!hideRasterExports && EXPORT_FORMATS.filter((f) => !hideGifExport || f.id !== "gif").map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onExport(f.id);
                      setExportMenuOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  >
                    {f.label}
                  </button>
                ))}
                {hideRasterExports && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onExport("png"); setExportMenuOpen(false); }}
                    className="flex w-full cursor-pointer items-center px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  >
                    PNG image
                  </button>
                )}
                {extraExports && extraExports.length > 0 && (
                  <>
                    <div className="my-1 border-t border-zinc-800" />
                    {extraExports.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); onExport(f.id); setExportMenuOpen(false); }}
                        className="flex w-full cursor-pointer items-center px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      >
                        {f.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {onSave && (
          <>
            <span className="mx-1 h-5 w-px bg-slate-800" />
            {onToggleVersions && (
              <button
                type="button"
                onClick={onToggleVersions}
                title="Version history"
                aria-label="Toggle version history"
                aria-pressed={!!versionsOpen}
                className={`cursor-pointer rounded-md p-1.5 transition ${versionsOpen ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}
              >
                <History className="h-4 w-4" />
              </button>
            )}
            {onToggleComments && (
              <button
                type="button"
                onClick={onToggleComments}
                title="Comments"
                aria-label="Toggle comments"
                aria-pressed={!!commentsOpen}
                className={`cursor-pointer rounded-md p-1.5 transition ${commentsOpen ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? "Saving…" : saved ? "Saved" : "Save"}
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function ToolButton({
  onClick,
  title,
  Icon,
}: {
  onClick: () => void;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
