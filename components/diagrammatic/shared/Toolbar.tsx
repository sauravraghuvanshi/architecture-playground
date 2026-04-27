/**
 * Toolbar — workspace top bar.
 *
 * Hosts: title, undo/redo, fit, delete, animate-flows toggle, save.
 */
"use client";

import { useState } from "react";
import { Undo2, Redo2, Maximize2, Trash2, Activity, Save, Loader2, Check, LayoutGrid, Play, Square, ChevronDown, Download, FolderOpen } from "lucide-react";

const TIERS = ["Edge", "Frontend", "Gateway", "Compute", "Messaging", "Data", "Ops", "Custom"] as const;
const EXPORT_FORMATS = [
  { id: "png" as const, label: "PNG image" },
  { id: "svg" as const, label: "SVG vector" },
  { id: "gif" as const, label: "Animated GIF (sequence)" },
  { id: "json" as const, label: "JSON (re-importable)" },
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
  /** Mode-specific starter templates. When provided, renders a Templates
   *  dropdown that calls onApplyTemplate(id) on selection. */
  templates?: Array<{ id: string; name: string; description?: string }>;
  onApplyTemplate?: (id: string) => void;
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
  templates,
  onApplyTemplate,
  saving,
  saved,
}: Props) {
  const [tierMenuOpen, setTierMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-200">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-zinc-100">{title}</span>
        <span className="text-xs text-zinc-500">Diagrammatic · React Flow</span>
      </div>
      <div className="flex items-center gap-1">
        <ToolButton onClick={onUndo} title="Undo (Ctrl+Z)" Icon={Undo2} />
        <ToolButton onClick={onRedo} title="Redo (Ctrl+Y)" Icon={Redo2} />
        <span className="mx-2 h-5 w-px bg-zinc-800" />
        <ToolButton onClick={onFit} title="Fit view (Ctrl+0)" Icon={Maximize2} />
        <ToolButton onClick={onDelete} title="Delete selection (Del)" Icon={Trash2} />
        {onAddTier && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setTierMenuOpen((o) => !o)}
              onBlur={() => setTimeout(() => setTierMenuOpen(false), 150)}
              title="Add tier / swimlane group"
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
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
                ? "bg-rose-400 text-zinc-950 hover:bg-rose-300"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
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
                ? "bg-lime-300 text-zinc-900 hover:bg-lime-200"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            {edgeStyle}
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
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
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
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronDown className="h-3 w-3" />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-2xl">
                {!hideRasterExports && EXPORT_FORMATS.map((f) => (
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
            <span className="mx-2 h-5 w-px bg-zinc-800" />
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-lime-300 px-3 py-1 text-xs font-semibold text-zinc-900 transition hover:bg-lime-200 disabled:opacity-60"
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
      className="cursor-pointer rounded-md p-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
