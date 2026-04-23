/**
 * GroupNode — a container/region around child nodes.
 * Resizable by React Flow's NodeResizer; dashed border colored by variant.
 */
"use client";

import { NodeResizer, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { GroupNodeData } from "../lib/types";

const VARIANT_STYLE: Record<GroupNodeData["variant"], { border: string; bg: string; chip: string; label: string }> = {
  vpc:              { border: "border-sky-400",      bg: "bg-sky-50/40 dark:bg-sky-950/20",       chip: "bg-sky-500",      label: "VPC" },
  "resource-group": { border: "border-blue-400",     bg: "bg-blue-50/40 dark:bg-blue-950/20",     chip: "bg-blue-500",     label: "Resource Group" },
  project:          { border: "border-emerald-400",  bg: "bg-emerald-50/40 dark:bg-emerald-950/20",chip: "bg-emerald-500",  label: "Project" },
  subnet:           { border: "border-violet-400",   bg: "bg-violet-50/40 dark:bg-violet-950/20", chip: "bg-violet-500",   label: "Subnet" },
  region:           { border: "border-amber-400",    bg: "bg-amber-50/40 dark:bg-amber-950/20",   chip: "bg-amber-500",    label: "Region" },
  custom:           { border: "border-zinc-400",     bg: "bg-zinc-50/40 dark:bg-zinc-900/20",     chip: "bg-zinc-500",     label: "Group" },
};

interface Props extends NodeProps {
  data: GroupNodeData & Record<string, unknown>;
}

function GroupNodeImpl({ data, selected }: Props) {
  const v = VARIANT_STYLE[data.variant] ?? VARIANT_STYLE.custom;
  return (
    <div
      className={`relative h-full w-full rounded-xl border-2 border-dashed ${v.border} ${v.bg} ${
        selected ? "ring-2 ring-offset-2 ring-brand-500" : ""
      }`}
    >
      <NodeResizer minWidth={160} minHeight={120} isVisible={selected} lineClassName="!border-brand-500" handleClassName="!bg-brand-500" />
      <div className={`absolute -top-3 left-3 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${v.chip}`}>
        {v.label}
      </div>
      {data.label && (
        <div className="absolute left-3 top-3 text-xs font-medium text-zinc-700 dark:text-zinc-200">
          {data.label}
        </div>
      )}
    </div>
  );
}

export const GroupNode = memo(GroupNodeImpl);
