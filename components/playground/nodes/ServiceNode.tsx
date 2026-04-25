/**
 * ServiceNode — a cloud service tile with icon + label + 4 connection handles.
 * Highlights with a pulse ring when its id is in the active set during playback.
 *
 * Uses a plain <img> tag instead of next/image to avoid re-render flicker
 * when React Flow updates nodes (e.g. on edge connect or selection change).
 */
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import type { ServiceNodeData } from "../lib/types";
import { usePlaygroundUI } from "../PlaygroundUIContext";

interface Props extends NodeProps {
  data: ServiceNodeData & { iconPath?: string } & Record<string, unknown>;
}

const CLOUD_RING: Record<string, string> = {
  azure: "ring-[#0078D4]",
  aws: "ring-[#FF9900]",
  gcp: "ring-[#4285F4]",
};

const CLOUD_BG: Record<string, string> = {
  azure: "bg-[#0078D4]",
  aws: "bg-[#FF9900]",
  gcp: "bg-[#4285F4]",
};

function ServiceNodeImpl({ id, data, selected }: Props) {
  const { activeNodeIds } = usePlaygroundUI();
  const isActive = activeNodeIds.includes(id);
  const [iconBroken, setIconBroken] = useState(false);
  const iconPath = data.iconPath;
  const label = data.label && String(data.label).trim().length > 0 ? data.label : "Service";
  const cloud = data.cloud ?? "azure";
  const initial = (label[0] ?? "S").toUpperCase();

  return (
    <div
      className={`group relative flex flex-col items-center gap-1 rounded-xl bg-white px-3 py-2 shadow-sm transition-all dark:bg-zinc-900 ${
        selected ? "ring-2 ring-brand-500" : "ring-1 ring-zinc-200 dark:ring-zinc-700"
      } ${isActive ? `animate-pulse ring-4 ${CLOUD_RING[cloud] ?? "ring-brand-500"}` : ""}`}
      style={{ minWidth: 96 }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-brand-500" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-brand-500" />
      <div className="relative flex h-12 w-12 items-center justify-center">
        {iconPath && !iconBroken ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={iconPath}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 select-none"
            draggable={false}
            loading="lazy"
            onError={() => setIconBroken(true)}
          />
        ) : (
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-white ${CLOUD_BG[cloud] ?? "bg-zinc-500"}`}
            aria-hidden
          >
            {initial}
          </div>
        )}
      </div>
      <div className="max-w-[140px] truncate text-center text-xs font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-brand-500" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-brand-500" />
    </div>
  );
}

export const ServiceNode = memo(ServiceNodeImpl);
