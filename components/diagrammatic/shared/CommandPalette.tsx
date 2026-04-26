"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Sparkles,
  Boxes,
  Workflow,
  Brain,
  GitBranch,
  Database,
  Layers,
  PenTool,
  ListChecks,
  Cpu,
  FileText,
  Download,
  Save,
  Maximize2,
  Undo2,
  Redo2,
  Trash2,
  Share2,
  Settings,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  group: "Create" | "Switch mode" | "Canvas" | "AI" | "Help";
  icon: LucideIcon;
  run: () => void;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: (id: string) => void;
}

/**
 * Cmd/Ctrl+K command palette. Fuzzy-filters across create / switch / canvas / AI commands.
 * Keyboard: ↑/↓ navigate · Enter select · Esc close.
 */
export function CommandPalette({ open, onOpenChange, onAction }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Build commands once. router/onAction live in closures.
  const commands = useMemo<CommandItem[]>(() => {
    const fire = (id: string, fn?: () => void) => () => {
      onAction?.(id);
      fn?.();
      onOpenChange(false);
    };
    return [
      { id: "new-arch", group: "Create", label: "New cloud architecture", shortcut: "⌘N", icon: Boxes, run: fire("new-arch", () => router.push("/diagrammatic")) },
      { id: "new-flow", group: "Create", label: "New flowchart", icon: Workflow, run: fire("new-flow", () => router.push("/diagrammatic?mode=flowchart")) },
      { id: "new-mind", group: "Create", label: "New mind map", icon: Brain, run: fire("new-mind") },
      { id: "new-seq", group: "Create", label: "New sequence diagram", icon: GitBranch, run: fire("new-seq") },
      { id: "new-er", group: "Create", label: "New ER diagram", icon: Database, run: fire("new-er") },
      { id: "new-uml", group: "Create", label: "New UML class diagram", icon: Layers, run: fire("new-uml") },
      { id: "new-wb", group: "Create", label: "New whiteboard", icon: PenTool, run: fire("new-wb") },
      { id: "new-kanban", group: "Create", label: "New Kanban board", icon: ListChecks, run: fire("new-kanban") },
      { id: "new-c4", group: "Create", label: "New C4 diagram", icon: Cpu, run: fire("new-c4") },

      { id: "mode-arch", group: "Switch mode", label: "Switch to Architecture", shortcut: "⌘1", icon: Boxes, run: fire("mode-arch") },
      { id: "mode-flow", group: "Switch mode", label: "Switch to Flowchart", shortcut: "⌘2", icon: Workflow, run: fire("mode-flow") },

      { id: "save", group: "Canvas", label: "Save", shortcut: "⌘S", icon: Save, run: fire("save") },
      { id: "fit", group: "Canvas", label: "Fit to screen", shortcut: "⌘0", icon: Maximize2, run: fire("fit") },
      { id: "undo", group: "Canvas", label: "Undo", shortcut: "⌘Z", icon: Undo2, run: fire("undo") },
      { id: "redo", group: "Canvas", label: "Redo", shortcut: "⌘⇧Z", icon: Redo2, run: fire("redo") },
      { id: "delete", group: "Canvas", label: "Delete selection", shortcut: "Del", icon: Trash2, run: fire("delete") },
      { id: "export-png", group: "Canvas", label: "Export as PNG", icon: Download, run: fire("export-png") },
      { id: "export-svg", group: "Canvas", label: "Export as SVG", icon: Download, run: fire("export-svg") },
      { id: "export-json", group: "Canvas", label: "Export as JSON", icon: FileText, run: fire("export-json") },
      { id: "share", group: "Canvas", label: "Share diagram", icon: Share2, run: fire("share") },

      { id: "ai-generate", group: "AI", label: "Generate diagram from prompt", icon: Sparkles, shortcut: "⌘G", run: fire("ai-generate") },
      { id: "ai-explain", group: "AI", label: "Explain this diagram", icon: FileText, run: fire("ai-explain") },
      { id: "ai-layout", group: "AI", label: "Auto-layout", icon: Plus, run: fire("ai-layout") },
      { id: "ai-validate", group: "AI", label: "Validate architecture", icon: HelpCircle, run: fire("ai-validate") },

      { id: "shortcuts", group: "Help", label: "Keyboard shortcuts", shortcut: "?", icon: HelpCircle, run: fire("shortcuts") },
      { id: "settings", group: "Help", label: "Settings", icon: Settings, run: fire("settings") },
    ];
  }, [router, onAction, onOpenChange]);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => `${c.label} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  // Group
  const grouped = useMemo(() => {
    const out: Record<string, CommandItem[]> = {};
    filtered.forEach((c) => {
      out[c.group] = out[c.group] ?? [];
      out[c.group].push(c);
    });
    return out;
  }, [filtered]);

  // Keep active in range
  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  // Global ⌘K / Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Focus on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[18%] z-[61] w-[92%] max-w-xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Command palette"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a command or search…"
                className="flex-1 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
              />
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-100 rounded">Esc</kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No commands match &ldquo;{query}&rdquo;
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group} className="mb-1">
                    <div className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                      {group}
                    </div>
                    {items.map((cmd) => {
                      const idx = filtered.indexOf(cmd);
                      const isActive = idx === active;
                      const I = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => cmd.run()}
                          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors cursor-pointer ${
                            isActive ? "bg-violet-50 text-violet-900" : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <I className={`w-4 h-4 shrink-0 ${isActive ? "text-violet-600" : "text-slate-400"}`} />
                          <span className="flex-1 text-sm font-medium truncate">{cmd.label}</span>
                          {cmd.shortcut && (
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-100 rounded">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
              <div className="flex items-center gap-2">
                <kbd className="px-1 py-0.5 font-mono bg-white border border-slate-200 rounded">↑↓</kbd>
                <span>navigate</span>
                <kbd className="px-1 py-0.5 font-mono bg-white border border-slate-200 rounded">↵</kbd>
                <span>select</span>
              </div>
              <span>{filtered.length} commands</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
