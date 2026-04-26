"use client";

import { Save, AlertTriangle, CheckCircle2, Wifi, WifiOff } from "lucide-react";

interface Props {
  nodeCount: number;
  edgeCount: number;
  zoom?: number;
  saved: boolean;
  saving: boolean;
  issuesCount: number;
  online?: boolean;
}

/**
 * IDE-style status bar at the bottom of the workspace.
 * Mirrors VS Code: counts on the left, connectivity/state on the right.
 */
export function StatusBar({
  nodeCount,
  edgeCount,
  zoom = 100,
  saved,
  saving,
  issuesCount,
  online = true,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-4 border-t border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] text-zinc-400 font-mono">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
      </span>
      <span className="text-zinc-600">·</span>
      <span>{edgeCount} {edgeCount === 1 ? "edge" : "edges"}</span>
      <span className="text-zinc-600">·</span>
      <span>{Math.round(zoom)}%</span>

      {issuesCount > 0 ? (
        <span className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          {issuesCount} {issuesCount === 1 ? "issue" : "issues"}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          No issues
        </span>
      )}

      <span className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1">
          {online ? (
            <Wifi className="w-3 h-3 text-emerald-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-rose-500" />
          )}
          {online ? "online" : "offline"}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="flex items-center gap-1">
          <Save className={`w-3 h-3 ${saving ? "animate-pulse text-violet-400" : saved ? "text-emerald-400" : "text-amber-400"}`} />
          {saving ? "saving…" : saved ? "saved" : "unsaved"}
        </span>
      </span>
    </div>
  );
}
