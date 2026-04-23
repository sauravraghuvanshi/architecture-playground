/**
 * Debounced autosave — pushes the persisted graph to localStorage 1s after
 * the last change. Returns a `restore()` to load on mount.
 */
"use client";

import { useEffect, useRef } from "react";
import { loadAutosave, saveAutosave } from "../lib/storage";
import type { PlaygroundGraph } from "../lib/types";

const DEBOUNCE_MS = 1000;

export function useAutosave(graph: PlaygroundGraph, enabled = true) {
  const timeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      saveAutosave(graph);
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [graph, enabled]);
}

export function restoreAutosave(): PlaygroundGraph | null {
  return loadAutosave();
}
