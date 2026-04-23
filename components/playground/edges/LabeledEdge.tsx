/**
 * LabeledEdge — bezier edge with optional label and step indicator.
 * Highlights when its id is in the active set during playback.
 */
"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import { usePlaygroundUI } from "../PlaygroundUIContext";

interface EdgeData {
  label?: string;
  animated?: boolean;
  step?: number;
  color?: string;
}

function LabeledEdgeImpl({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd,
}: EdgeProps & { data?: EdgeData }) {
  const { activeEdgeIds, isPlaying } = usePlaygroundUI();
  const isActive = activeEdgeIds.includes(id);
  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const baseColor = data?.color ?? "#64748b";
  const activeColor = "#0078D4";
  const stroke = isActive ? activeColor : selected ? "#2563eb" : baseColor;
  const strokeWidth = isActive ? 3.5 : selected ? 2.5 : 1.75;
  // Animated dashes when edge is animated OR when sequence playback is running and this is the active frame.
  const animated = data?.animated || isActive;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: animated ? "6 4" : undefined,
          animation: animated ? "playgroundDash 1.2s linear infinite" : undefined,
          opacity: isPlaying && !isActive && !animated ? 0.35 : 1,
          transition: "stroke 120ms ease, stroke-width 120ms ease, opacity 120ms ease",
        }}
      />
      {(data?.label || data?.step) && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto absolute flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data?.step !== undefined && (
              <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">{data.step}</span>
            )}
            {data?.label && <span className="text-zinc-700 dark:text-zinc-200">{data.label}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LabeledEdge = memo(LabeledEdgeImpl);
