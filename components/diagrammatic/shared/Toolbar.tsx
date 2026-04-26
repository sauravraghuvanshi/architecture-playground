/**
 * Toolbar — shared mode-aware top bar (zoom, fit, undo/redo, export, save).
 * R1 wires only the architecture-relevant actions; future modes attach more.
 */
"use client";

interface Props {
  title: string;
  onFit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
}

export function Toolbar({ title, onFit, onUndo, onRedo, onDelete, onSave, saving, saved }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-200">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-zinc-100">{title}</span>
        <span className="text-xs text-zinc-500">Diagrammatic · powered by maxGraph</span>
      </div>
      <div className="flex items-center gap-1">
        <ToolButton onClick={onUndo} title="Undo (Ctrl+Z)">↶</ToolButton>
        <ToolButton onClick={onRedo} title="Redo (Ctrl+Y)">↷</ToolButton>
        <span className="mx-2 h-5 w-px bg-zinc-800" />
        <ToolButton onClick={onFit} title="Fit view">⤢</ToolButton>
        <ToolButton onClick={onDelete} title="Delete selection (Del)">🗑</ToolButton>
        {onSave && (
          <>
            <span className="mx-2 h-5 w-px bg-zinc-800" />
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
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
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-md px-2 py-1 text-base text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
    >
      {children}
    </button>
  );
}
