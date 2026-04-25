/**
 * CommandPalette — Ctrl+K fuzzy search overlay for all playground actions.
 * Uses Framer Motion for smooth entry/exit.
 */
"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Undo2, Redo2, Trash2, FileJson, FileImage, Film, Play, Pause,
  Wand2, Maximize, Download, Keyboard, Repeat,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  disabled?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

function CommandPaletteImpl({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.filter((c) => !c.disabled);
    const q = query.toLowerCase();
    return commands.filter(
      (c) => !c.disabled && (c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    );
  }, [commands, query]);

  // Focus input when opening (no setState needed — fresh mount via key resets state)
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) {
          cmd.action();
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIndex, onClose]
  );

  // Keep selected index in bounds when filter results change
  const clampedIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0));
  if (clampedIndex !== selectedIndex) {
    setSelectedIndex(clampedIndex);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="w-[460px] max-w-[90vw] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="border-b border-zinc-200 p-3 dark:border-zinc-700">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command…"
                className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
              />
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-zinc-400">No commands found.</p>
              )}
              {filtered.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors ${
                    idx === selectedIndex
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                    {cmd.icon}
                  </span>
                  <span className="flex-1">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-200 px-3 py-2 text-[10px] text-zinc-400 dark:border-zinc-700">
              ↑↓ navigate · Enter select · Esc close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const CommandPalette = memo(CommandPaletteImpl);

// Helper to build command list from playground actions
export function buildCommands(actions: {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  onExportJson: () => void;
  onExportGif: () => void;
  onAutoSequence: () => void;
  onFitView: () => void;
  onToggleShortcuts: () => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isPlaying: boolean;
  totalSteps: number;
}): Command[] {
  return [
    { id: "undo", label: "Undo", shortcut: "Ctrl+Z", icon: <Undo2 className="h-3.5 w-3.5" />, action: actions.onUndo, disabled: !actions.canUndo },
    { id: "redo", label: "Redo", shortcut: "Ctrl+Y", icon: <Redo2 className="h-3.5 w-3.5" />, action: actions.onRedo, disabled: !actions.canRedo },
    { id: "clear", label: "Clear canvas", icon: <Trash2 className="h-3.5 w-3.5" />, action: actions.onClear },
    { id: "fit-view", label: "Fit view", shortcut: "F", icon: <Maximize className="h-3.5 w-3.5" />, action: actions.onFitView },
    { id: "play-pause", label: actions.isPlaying ? "Pause sequence" : "Play sequence", shortcut: "Space", icon: actions.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />, action: actions.onTogglePlay, disabled: actions.totalSteps === 0 },
    { id: "toggle-loop", label: "Toggle loop", shortcut: "L", icon: <Repeat className="h-3.5 w-3.5" />, action: actions.onToggleLoop },
    { id: "auto-sequence", label: "Auto-sequence from topology", icon: <Wand2 className="h-3.5 w-3.5" />, action: actions.onAutoSequence },
    { id: "export-png", label: "Export PNG", shortcut: "Ctrl+E", icon: <FileImage className="h-3.5 w-3.5" />, action: actions.onExportPng },
    { id: "export-json", label: "Export JSON", shortcut: "Ctrl+S", icon: <FileJson className="h-3.5 w-3.5" />, action: actions.onExportJson },
    { id: "export-gif", label: "Export animated GIF", icon: <Film className="h-3.5 w-3.5" />, action: actions.onExportGif, disabled: actions.totalSteps === 0 },
    { id: "import", label: "Import JSON file", icon: <Download className="h-3.5 w-3.5" />, action: () => {} },
    { id: "shortcuts", label: "Keyboard shortcuts", shortcut: "?", icon: <Keyboard className="h-3.5 w-3.5" />, action: actions.onToggleShortcuts },
  ];
}
