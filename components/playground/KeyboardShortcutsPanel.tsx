/**
 * KeyboardShortcutsPanel — overlay showing all keyboard shortcuts.
 * Toggled via the `?` key or a toolbar button.
 */
"use client";

import { memo } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Canvas",
    shortcuts: [
      { keys: ["Delete", "Backspace"], description: "Delete selected elements" },
      { keys: ["Ctrl+Z"], description: "Undo" },
      { keys: ["Ctrl+Y", "Ctrl+Shift+Z"], description: "Redo" },
      { keys: ["Ctrl+C"], description: "Copy selected" },
      { keys: ["Ctrl+V"], description: "Paste" },
      { keys: ["Ctrl+D"], description: "Duplicate selected" },
      { keys: ["↑ ↓ ← →"], description: "Nudge selected nodes (1px)" },
      { keys: ["Shift+↑↓←→"], description: "Nudge selected nodes (10px)" },
      { keys: ["F"], description: "Fit view" },
      { keys: ["Escape"], description: "Cancel placement / deselect" },
      { keys: ["Right-click"], description: "Context menu" },
    ],
  },
  {
    title: "Sequence",
    shortcuts: [
      { keys: ["Space"], description: "Play / Pause sequence" },
      { keys: ["L"], description: "Toggle loop" },
    ],
  },
  {
    title: "Export",
    shortcuts: [
      { keys: ["Ctrl+S"], description: "Export JSON" },
      { keys: ["Ctrl+E"], description: "Export PNG" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: ["Ctrl+K"], description: "Command palette" },
      { keys: ["?"], description: "Toggle this shortcuts panel" },
    ],
  },
];

function KeyboardShortcutsPanelImpl({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-[420px] max-w-[90vw] rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close shortcuts"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Keyboard Shortcuts
            </h2>

            <div className="space-y-4">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {group.title}
                  </h3>
                  <div className="space-y-1.5">
                    {group.shortcuts.map((s) => (
                      <div key={s.description} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400">{s.description}</span>
                        <div className="flex gap-1">
                          {s.keys.map((k) => (
                            <kbd
                              key={k}
                              className="inline-flex min-w-[24px] items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const KeyboardShortcutsPanel = memo(KeyboardShortcutsPanelImpl);
