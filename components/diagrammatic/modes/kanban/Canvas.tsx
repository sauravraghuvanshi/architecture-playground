/**
 * Kanban mode — pure dnd-kit, no React Flow.
 *
 * Columns are ``SortableContext`` containers; cards are ``useSortable`` items
 * that can be reordered within or moved across columns. Each column
 * optionally enforces a WIP limit (visual warning when exceeded).
 *
 * Textual export ('md') produces a Markdown checklist grouped by column.
 */
"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BaseCanvasHandle } from "../../shared/modeRegistry";

export interface KanbanCard { id: string; title: string; description?: string; label?: string }
export interface KanbanColumn { id: string; title: string; wipLimit?: number; cardIds: string[] }
export interface KanbanPayload { columns: KanbanColumn[]; cards: Record<string, KanbanCard> }

export const KANBAN_DEFAULT_PAYLOAD: KanbanPayload = {
  columns: [
    { id: "backlog", title: "Backlog", cardIds: ["c1", "c2", "c3"] },
    { id: "doing",   title: "In progress", wipLimit: 2, cardIds: ["c4"] },
    { id: "review",  title: "Review", wipLimit: 2, cardIds: ["c5"] },
    { id: "done",    title: "Done", cardIds: ["c6"] },
  ],
  cards: {
    c1: { id: "c1", title: "Onboarding flow", label: "growth" },
    c2: { id: "c2", title: "Audit log retention policy", label: "compliance" },
    c3: { id: "c3", title: "Refresh marketing copy", label: "design" },
    c4: { id: "c4", title: "Animated GIF export", label: "feature" },
    c5: { id: "c5", title: "Sequence-mode toolbar", label: "feature" },
    c6: { id: "c6", title: "Dark theme toggle", label: "design" },
  },
};

const LABEL_COLORS: Record<string, string> = {
  feature:    "bg-lime-300 text-zinc-950",
  design:     "bg-fuchsia-400 text-zinc-950",
  growth:     "bg-sky-400 text-zinc-950",
  compliance: "bg-amber-300 text-zinc-950",
};

interface SortableCardProps { card: KanbanCard }
const SortableCardImpl = ({ card }: SortableCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-md border border-zinc-700 bg-zinc-900 p-3 text-left text-[13px] text-zinc-100 shadow-sm hover:border-zinc-500 active:cursor-grabbing"
    >
      <div className="font-semibold">{card.title}</div>
      {card.description && <div className="mt-1 text-[11px] text-zinc-400">{card.description}</div>}
      {card.label && (
        <span className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${LABEL_COLORS[card.label] ?? "bg-zinc-700 text-zinc-100"}`}>
          {card.label}
        </span>
      )}
    </div>
  );
};
const SortableCard = memo(SortableCardImpl);

interface ColumnProps {
  column: KanbanColumn;
  cards: KanbanCard[];
  onAddCard: (colId: string) => void;
}
const ColumnImpl = ({ column, cards, onAddCard }: ColumnProps) => {
  const overLimit = column.wipLimit !== undefined && cards.length > column.wipLimit;
  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg border border-zinc-800 bg-zinc-950/60">
      <div className={`flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] ${overLimit ? "bg-rose-900/40 text-rose-200" : "text-zinc-300"}`}>
        <span>{column.title} <span className="ml-1 font-mono text-zinc-500">{cards.length}{column.wipLimit !== undefined ? ` / ${column.wipLimit}` : ""}</span></span>
        <button onClick={() => onAddCard(column.id)} className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800">+ Add</button>
      </div>
      <SortableContext id={column.id} items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3" data-column-id={column.id}>
          {cards.map((c) => <SortableCard key={c.id} card={c} />)}
          {cards.length === 0 && <div className="rounded border border-dashed border-zinc-800 p-4 text-center text-[10px] text-zinc-600">drop here</div>}
        </div>
      </SortableContext>
    </div>
  );
};
const Column = memo(ColumnImpl);

function exportMarkdown(p: KanbanPayload): string {
  const lines: string[] = ["# Kanban", ""];
  for (const col of p.columns) {
    lines.push(`## ${col.title}${col.wipLimit !== undefined ? ` _(WIP ${col.cardIds.length}/${col.wipLimit})_` : ""}`, "");
    for (const cid of col.cardIds) {
      const card = p.cards[cid];
      if (!card) continue;
      const checked = col.id === "done" ? "x" : " ";
      lines.push(`- [${checked}] **${card.title}**${card.label ? ` _(${card.label})_` : ""}`);
      if (card.description) lines.push(`  - ${card.description}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

interface Props { value: KanbanPayload; onChange?: (p: KanbanPayload) => void; }

function findColumnByCard(p: KanbanPayload, cardId: string): KanbanColumn | undefined {
  return p.columns.find((c) => c.cardIds.includes(cardId));
}

export const KanbanCanvas = forwardRef<BaseCanvasHandle, Props>(function KanbanCanvas({ value, onChange }, ref) {
  const [state, setState] = useState<KanbanPayload>(value);
  const past = useRef<KanbanPayload[]>([]);
  const future = useRef<KanbanPayload[]>([]);
  const skipNext = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const snapshot = useCallback(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    past.current.push(JSON.parse(JSON.stringify(state)));
    if (past.current.length > 100) past.current.shift();
    future.current = [];
  }, [state]);

  useEffect(() => { onChange?.(state); }, [state, onChange]);

  const onDragStart = (e: DragStartEvent) => { setActiveId(String(e.active.id)); };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    setState((prev) => {
      const fromCol = findColumnByCard(prev, activeIdStr);
      if (!fromCol) return prev;
      // over.id may be another card id or a column id.
      const toCol = prev.columns.find((c) => c.id === overIdStr) ?? findColumnByCard(prev, overIdStr);
      if (!toCol) return prev;
      if (fromCol.id === toCol.id && activeIdStr !== overIdStr) {
        const oldIdx = fromCol.cardIds.indexOf(activeIdStr);
        const newIdx = fromCol.cardIds.indexOf(overIdStr);
        if (oldIdx === -1 || newIdx === -1) return prev;
        snapshot();
        return {
          ...prev,
          columns: prev.columns.map((c) =>
            c.id === fromCol.id ? { ...c, cardIds: arrayMove(c.cardIds, oldIdx, newIdx) } : c
          ),
        };
      }
      if (fromCol.id !== toCol.id) {
        snapshot();
        const removed = fromCol.cardIds.filter((id) => id !== activeIdStr);
        // Drop position: if dropped on a card, insert before that card; if on column, append.
        let insertIdx = toCol.cardIds.length;
        if (toCol.cardIds.includes(overIdStr)) insertIdx = toCol.cardIds.indexOf(overIdStr);
        const newToIds = [...toCol.cardIds.slice(0, insertIdx), activeIdStr, ...toCol.cardIds.slice(insertIdx)];
        return {
          ...prev,
          columns: prev.columns.map((c) =>
            c.id === fromCol.id ? { ...c, cardIds: removed }
            : c.id === toCol.id ? { ...c, cardIds: newToIds }
            : c
          ),
        };
      }
      return prev;
    });
  };

  const onAddCard = (colId: string) => {
    const id = `c_${Date.now().toString(36)}`;
    snapshot();
    setState((prev) => ({
      ...prev,
      cards: { ...prev.cards, [id]: { id, title: "New card" } },
      columns: prev.columns.map((c) => c.id === colId ? { ...c, cardIds: [...c.cardIds, id] } : c),
    }));
  };

  useImperativeHandle(ref, () => ({
    serialize: () => state,
    hydrate: (p) => { skipNext.current = true; setState(p as KanbanPayload); },
    fit: () => { /* no-op */ },
    undo: () => {
      const prev = past.current.pop();
      if (!prev) return;
      future.current.push(state);
      skipNext.current = true;
      setState(prev);
    },
    redo: () => {
      const next = future.current.pop();
      if (!next) return;
      past.current.push(state);
      skipNext.current = true;
      setState(next);
    },
    deleteSelection: () => { /* no inline selection model here */ },
    exportText: (format) => format === "md" ? exportMarkdown(state) : null,
  }), [state]);

  const activeCard = activeId ? state.cards[activeId] : null;

  return (
    <div className="h-full w-full overflow-x-auto bg-zinc-950 p-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex h-full gap-4">
          {state.columns.map((col) => (
            <Column key={col.id} column={col} cards={col.cardIds.map((id) => state.cards[id]).filter(Boolean)} onAddCard={onAddCard} />
          ))}
        </div>
        <DragOverlay>
          {activeCard ? (
            <div className="rounded-md border border-lime-300 bg-zinc-900 p-3 text-[13px] text-zinc-100 shadow-xl">
              <div className="font-semibold">{activeCard.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});
