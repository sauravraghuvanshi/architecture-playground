/** StickyNoteNode — free-text annotation. */
"use client";
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { StickyNodeData } from "../lib/types";

interface Props extends NodeProps { data: StickyNodeData & Record<string, unknown>; }

function StickyNoteNodeImpl({ data, selected }: Props) {
  const bg = data.color ?? "#fef9c3";
  return (
    <div
      className={`max-w-[220px] rounded-md p-3 text-xs leading-snug text-zinc-900 shadow-sm ${
        selected ? "ring-2 ring-brand-500" : ""
      }`}
      style={{ background: bg }}
    >
      {data.label || "Note"}
    </div>
  );
}

export const StickyNoteNode = memo(StickyNoteNodeImpl);
