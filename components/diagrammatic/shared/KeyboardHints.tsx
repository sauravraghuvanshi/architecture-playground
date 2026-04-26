"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: "General",
    items: [
      ["⌘K", "Open command palette"],
      ["⌘S", "Save"],
      ["⌘Z", "Undo"],
      ["⌘⇧Z", "Redo"],
      ["?", "Show this panel"],
    ],
  },
  {
    title: "Canvas",
    items: [
      ["⌘0", "Fit to screen"],
      ["⌘+ / ⌘-", "Zoom in / out"],
      ["Space + drag", "Pan"],
      ["Del / Backspace", "Delete selection"],
      ["⌘D", "Duplicate selection"],
    ],
  },
  {
    title: "Modes",
    items: [
      ["⌘1", "Architecture"],
      ["⌘2", "Flowchart"],
      ["⌘3", "Mind map"],
      ["⌘7", "Whiteboard"],
    ],
  },
  {
    title: "AI",
    items: [
      ["⌘G", "Generate from prompt"],
      ["⌘E", "Explain diagram"],
      ["⌘L", "Auto-layout"],
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeyboardHints({ open, onClose }: Props) {
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
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed left-1/2 top-1/2 z-[61] w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-200 shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Keyboard shortcuts"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
              <h2 className="text-sm font-bold text-zinc-100">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 px-5 py-5">
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2">{g.title}</h3>
                  <dl className="space-y-1.5">
                    {g.items.map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-zinc-300">{label}</dt>
                        <dd>
                          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 rounded">
                            {key}
                          </kbd>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <div className="border-t border-zinc-800 bg-zinc-900/50 px-5 py-2 text-[10px] text-zinc-500">
              On Windows / Linux, ⌘ = Ctrl.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
