/**
 * Toolbar — all top actions: file (templates, import, export), edit (undo, redo,
 * clear), and sequence (play/pause/loop/speed/auto-sequence/export GIF).
 */
"use client";

import { useRef } from "react";
import {
  Download, Upload, FileText, Undo2, Redo2, Trash2, Play, Pause,
  Repeat, Gauge, FileImage, FileJson, Wand2, Film, Maximize, Keyboard,
} from "lucide-react";
import type { PlaygroundTemplate } from "./lib/types";
import { usePlaygroundUI } from "./PlaygroundUIContext";

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  totalSteps: number;
  templates: PlaygroundTemplate[];
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onLoadTemplate: (id: string) => void;
  onImportFile: (file: File) => void;
  onExportPng: () => void;
  onExportJson: () => void;
  onExportGif: () => void;
  onExportFormat: (format: "svg" | "png-2x" | "png-4x" | "mermaid" | "drawio" | "iac") => void;
  onAutoSequence: () => void;
  onFitView: () => void;
  onToggleShortcuts: () => void;
}

export function Toolbar({
  canUndo, canRedo, totalSteps, templates,
  onUndo, onRedo, onClear, onLoadTemplate, onImportFile,
  onExportPng, onExportJson, onExportGif, onExportFormat, onAutoSequence, onFitView, onToggleShortcuts,
}: Props) {
  const { isPlaying, setPlaying, loop, setLoop, speed, setSpeed, exportProgress } = usePlaygroundUI();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      {/* Templates */}
      <div className="relative">
        <select
          aria-label="Load template"
          className="rounded-md border border-zinc-200 bg-zinc-50 py-1 pl-7 pr-2 text-xs text-zinc-700 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          onChange={(e) => {
            if (e.target.value) onLoadTemplate(e.target.value);
            e.target.selectedIndex = 0;
          }}
        >
          <option value="">Templates</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <FileText className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
      </div>

      <Divider />

      {/* Edit */}
      <IconBtn label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}><Undo2 className="h-4 w-4" /></IconBtn>
      <IconBtn label="Redo (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}><Redo2 className="h-4 w-4" /></IconBtn>
      <IconBtn label="Clear canvas" onClick={onClear}><Trash2 className="h-4 w-4 text-red-600" /></IconBtn>
      <IconBtn label="Fit view (F)" onClick={onFitView}><Maximize className="h-4 w-4" /></IconBtn>

      <Divider />

      {/* Sequence */}
      <IconBtn
        label={isPlaying ? "Pause sequence" : "Play sequence"}
        disabled={totalSteps === 0}
        onClick={() => setPlaying(!isPlaying)}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </IconBtn>
      <IconBtn label={loop ? "Loop on" : "Loop off"} active={loop} onClick={() => setLoop(!loop)}>
        <Repeat className="h-4 w-4" />
      </IconBtn>
      <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        <Gauge className="h-3 w-3" aria-hidden />
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded px-1.5 py-0.5 ${
              speed === s ? "bg-brand-500 text-white" : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
            aria-pressed={speed === s}
            aria-label={`Speed ${s}x`}
          >
            {s}x
          </button>
        ))}
      </div>
      <IconBtn label="Auto-sequence from topology" onClick={onAutoSequence}><Wand2 className="h-4 w-4" /></IconBtn>
      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        {totalSteps} step{totalSteps === 1 ? "" : "s"}
      </span>

      <Divider />

      {/* IO */}
      <IconBtn label="Import JSON" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /></IconBtn>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json,.drawio,.xml,application/xml,text/xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = "";
        }}
      />
      <IconBtn label="Export JSON" onClick={onExportJson}><FileJson className="h-4 w-4" /></IconBtn>
      <IconBtn label="Export PNG" onClick={onExportPng}><FileImage className="h-4 w-4" /></IconBtn>
      <select
        aria-label="Export format"
        className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        onChange={(e) => {
          const val = e.target.value;
          if (val) onExportFormat(val as Parameters<typeof onExportFormat>[0]);
          e.target.selectedIndex = 0;
        }}
      >
        <option value="">More…</option>
        <option value="svg">SVG (vector)</option>
        <option value="png-2x">PNG (2x)</option>
        <option value="png-4x">PNG (4x)</option>
        <option value="mermaid">Mermaid (.mmd)</option>
        <option value="drawio">draw.io XML</option>
        <option value="iac">Bicep / Terraform…</option>
      </select>
      <IconBtn
        label={totalSteps === 0 ? "Set edge steps to enable GIF export" : "Export animated GIF"}
        disabled={totalSteps === 0 || exportProgress !== null}
        onClick={onExportGif}
      >
        <Film className="h-4 w-4" />
      </IconBtn>

      <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-zinc-500">
        <IconBtn label="Keyboard shortcuts (?)" onClick={onToggleShortcuts}><Keyboard className="h-4 w-4" /></IconBtn>
        <span className="inline-flex items-center gap-1">
          <Download className="h-3 w-3" aria-hidden /> autosaved
        </span>
      </span>
    </div>
  );
}

function IconBtn({
  label, onClick, disabled, active, children,
}: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
        active
          ? "bg-brand-500 text-white"
          : "text-zinc-700 hover:bg-zinc-100 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() { return <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />; }
