"use client";

import { Save, AlertTriangle, CheckCircle2, Wifi, WifiOff } from "lucide-react";

interface Props {
  nodeCount?: number;
  edgeCount?: number;
  zoom?: number;
  saved: boolean;
  saving: boolean;
  issuesCount?: number;
  online?: boolean;
}

/**
 * IDE-style status bar at the bottom of the workspace.
 * Mirrors VS Code: counts on the left, connectivity/state on the right.
 */
export function StatusBar({
  nodeCount,
  edgeCount,
  zoom,
  saved,
  saving,
  issuesCount,
  online = true,
}: Props) {
  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-slate-800 bg-[#08111f] px-3 font-mono text-[10px] text-slate-500">
      {nodeCount !== undefined && <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
        {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
      </span>}
      {edgeCount !== undefined && <span>{edgeCount} {edgeCount === 1 ? "edge" : "edges"}</span>}
      {zoom !== undefined && <span>{Math.round(zoom)}%</span>}

      {issuesCount !== undefined && (issuesCount > 0 ? (
        <span className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          {issuesCount} {issuesCount === 1 ? "issue" : "issues"}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          No issues
        </span>
      ))}

      <span className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1">
          {online ? (
            <Wifi className="w-3 h-3 text-emerald-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-rose-500" />
          )}
          {online ? "local-first" : "offline"}
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
