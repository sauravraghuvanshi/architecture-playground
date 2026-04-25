/**
 * ContextMenu — right-click context menu for canvas nodes and pane.
 * Uses Framer Motion for smooth entry/exit.
 */
"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import {
  Copy, Trash2, FolderPlus, Maximize, StickyNote, ClipboardPaste,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
  edgeId?: string;
}

interface Props {
  menu: ContextMenuState | null;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onAddNote: (x: number, y: number) => void;
  onPaste: () => void;
  onFitView: () => void;
  hasClipboard: boolean;
}

function ContextMenuImpl({
  menu, onClose, onDuplicate, onDelete, onGroup, onAddNote, onPaste, onFitView, hasClipboard,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menu, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!menu) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menu, onClose]);

  const handleAction = useCallback((action: () => void) => {
    action();
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {menu && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-50 min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.nodeId ? (
            /* Node context menu */
            <>
              <MenuItem icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate" shortcut="Ctrl+D" onClick={() => handleAction(onDuplicate)} />
              <MenuItem icon={<FolderPlus className="h-3.5 w-3.5" />} label="Group selection" onClick={() => handleAction(onGroup)} />
              <Separator />
              <MenuItem icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} label="Delete" shortcut="Del" onClick={() => handleAction(onDelete)} danger />
            </>
          ) : (
            /* Pane context menu */
            <>
              <MenuItem icon={<ClipboardPaste className="h-3.5 w-3.5" />} label="Paste" shortcut="Ctrl+V" onClick={() => handleAction(onPaste)} disabled={!hasClipboard} />
              <MenuItem icon={<StickyNote className="h-3.5 w-3.5" />} label="Add note here" onClick={() => handleAction(() => onAddNote(menu.x, menu.y))} />
              <Separator />
              <MenuItem icon={<Maximize className="h-3.5 w-3.5" />} label="Fit view" shortcut="F" onClick={() => handleAction(onFitView)} />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuItem({
  icon, label, shortcut, onClick, disabled, danger,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{shortcut}</span>
      )}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />;
}

export const ContextMenu = memo(ContextMenuImpl);
