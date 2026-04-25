/**
 * LabeledEdge — bezier edge with optional label, step indicator, and
 * connection-type-aware styling (line style, arrow style, color hints).
 * Highlights when its id is in the active set during playback.
 */
"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import { usePlaygroundUI } from "../PlaygroundUIContext";
import type { ConnectionType, LineStyle, ArrowStyle } from "../lib/types";

interface EdgeData {
  label?: string;
  animated?: boolean;
  step?: number;
  color?: string;
  connectionType?: ConnectionType;
  protocol?: string;
  lineStyle?: LineStyle;
  arrowStyle?: ArrowStyle;
  description?: string;
}

/** Map connection type to a subtle default color when no explicit color is set. */
const CONNECTION_TYPE_COLORS: Record<ConnectionType, string> = {
  "data-flow": "#64748b",
  network: "#0284c7",
  dependency: "#9333ea",
  sequence: "#0078D4",
  custom: "#64748b",
};

function getDashArray(lineStyle: LineStyle | undefined, animated: boolean): string | undefined {
  if (animated) return "6 4";
  switch (lineStyle) {
    case "dashed": return "8 4";
    case "dotted": return "3 3";
    default: return undefined;
  }
}

function LabeledEdgeImpl({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd,
}: EdgeProps & { data?: EdgeData }) {
  const { activeEdgeIds, isPlaying } = usePlaygroundUI();
  const isActive = activeEdgeIds.includes(id);
  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const connType = data?.connectionType ?? "data-flow";
  const baseColor = data?.color ?? CONNECTION_TYPE_COLORS[connType];
  const activeColor = "#0078D4";
  const stroke = isActive ? activeColor : selected ? "#2563eb" : baseColor;
  const strokeWidth = isActive ? 3.5 : selected ? 2.5 : 1.75;
  const animated = data?.animated || isActive;
  const dashArray = getDashArray(data?.lineStyle, animated);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: dashArray,
          animation: animated ? "playgroundDash 1.2s linear infinite" : undefined,
          opacity: isPlaying && !isActive && !animated ? 0.35 : 1,
          transition: "stroke 120ms ease, stroke-width 120ms ease, opacity 120ms ease",
        }}
      />
      {(data?.label || data?.step || data?.protocol) && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto absolute flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data?.step !== undefined && (
              <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">{data.step}</span>
            )}
            {data?.label && <span className="text-zinc-700 dark:text-zinc-200">{data.label}</span>}
            {data?.protocol && !data?.label && (
              <span className="text-zinc-400 dark:text-zinc-500 italic">{data.protocol}</span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LabeledEdge = memo(LabeledEdgeImpl);
