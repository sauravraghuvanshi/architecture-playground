/**
 * Pure history reducer for undo/redo.
 * - Snapshot stack capped at 50 entries.
 * - Identical consecutive snapshots are deduped (cheap structural compare).
 * - Pushing a new snapshot when undo cursor is in the middle truncates the
 *   "redo" tail (standard linear history).
 *
 * The reducer is intentionally agnostic to React Flow — it operates on opaque
 * snapshot strings (stringified PlaygroundGraph). The hook (useUndoRedo)
 * decides when to push and what to apply on undo/redo.
 */
import type { PlaygroundGraph } from "./types";

const MAX_HISTORY = 50;

export interface HistoryState {
  past: string[];        // serialized graph snapshots
  present: string;
  future: string[];
}

export type HistoryAction =
  | { type: "push"; snapshot: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; snapshot: string };

export function snapshotGraph(graph: PlaygroundGraph): string {
  return JSON.stringify(graph);
}

export function initialHistory(initial: PlaygroundGraph): HistoryState {
  return { past: [], present: snapshotGraph(initial), future: [] };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "push": {
      if (action.snapshot === state.present) return state;
      const past = [...state.past, state.present];
      while (past.length > MAX_HISTORY) past.shift();
      return { past, present: action.snapshot, future: [] };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const past = state.past.slice(0, -1);
      return { past, present: previous, future: [state.present, ...state.future] };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest };
    }
    case "reset":
      return { past: [], present: action.snapshot, future: [] };
    default:
      return state;
  }
}

export function canUndo(state: HistoryState): boolean { return state.past.length > 0; }
export function canRedo(state: HistoryState): boolean { return state.future.length > 0; }

export const HISTORY_LIMIT = MAX_HISTORY;
