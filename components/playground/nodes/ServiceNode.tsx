/**
 * ServiceNode — a cloud service tile with icon + label + 4 connection handles.
 * Highlights with a pulse ring when its id is in the active set during playback.
 */
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import Image from "next/image";
import { memo } from "react";
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

function ServiceNodeImpl({ id, data, selected }: Props) {
  const { activeNodeIds } = usePlaygroundUI();
  const isActive = activeNodeIds.includes(id);
  const iconPath = data.iconPath ?? "/cloud-icons/azure/compute/app-service.svg";

  return (
    <div
      className={`group relative flex flex-col items-center gap-1 rounded-xl bg-white px-3 py-2 shadow-sm transition-all dark:bg-zinc-900 ${
        selected ? "ring-2 ring-brand-500" : "ring-1 ring-zinc-200 dark:ring-zinc-700"
      } ${isActive ? `animate-pulse ring-4 ${CLOUD_RING[data.cloud] ?? "ring-brand-500"}` : ""}`}
      style={{ minWidth: 96 }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-brand-500" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-brand-500" />
      <div className="relative h-12 w-12">
        <Image
          src={iconPath}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="h-12 w-12 select-none"
          draggable={false}
        />
      </div>
      <div className="max-w-[140px] truncate text-center text-xs font-medium text-zinc-900 dark:text-zinc-100">
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-brand-500" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-brand-500" />
    </div>
  );
}

export const ServiceNode = memo(ServiceNodeImpl);
