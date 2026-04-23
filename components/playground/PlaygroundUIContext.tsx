/**
 * Ephemeral UI state for the playground — selection, playback overlay,
 * modal/announcement state, export progress.
 *
 * IMPORTANT: nothing in this context is persisted. The persisted graph lives
 * in <Playground/> useReducer state and is autosaved separately. Keeping
 * these concerns split prevents playback ticks from polluting history /
 * autosave.
 */
"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

interface PlaygroundUIState {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  activeNodeIds: string[];   // playback highlight
  activeEdgeIds: string[];   // playback highlight
  isPlaying: boolean;
  loop: boolean;
  speed: number;             // 0.5 | 1 | 2
  placementIconId: string | null; // tap-to-place mode
  exportProgress: number | null;  // null | 0..1
  announcement: string;
}

interface PlaygroundUIActions {
  setSelected: (nodeIds: string[], edgeIds: string[]) => void;
  setActive: (nodeIds: string[], edgeIds: string[]) => void;
  setPlaying: (v: boolean) => void;
  setLoop: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setPlacementIconId: (id: string | null) => void;
  setExportProgress: (p: number | null) => void;
  announce: (msg: string) => void;
}

type Ctx = PlaygroundUIState & PlaygroundUIActions;

const PlaygroundUIContext = createContext<Ctx | null>(null);

export function PlaygroundUIProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlaygroundUIState>({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    activeNodeIds: [],
    activeEdgeIds: [],
    isPlaying: false,
    loop: true,
    speed: 1,
    placementIconId: null,
    exportProgress: null,
    announcement: "",
  });
  const announceTimeout = useRef<number | null>(null);

  const setSelected = useCallback((nodeIds: string[], edgeIds: string[]) => {
    setState((s) => ({ ...s, selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }));
  }, []);
  const setActive = useCallback((nodeIds: string[], edgeIds: string[]) => {
    setState((s) => ({ ...s, activeNodeIds: nodeIds, activeEdgeIds: edgeIds }));
  }, []);
  const setPlaying = useCallback((v: boolean) => setState((s) => ({ ...s, isPlaying: v })), []);
  const setLoop = useCallback((v: boolean) => setState((s) => ({ ...s, loop: v })), []);
  const setSpeed = useCallback((v: number) => setState((s) => ({ ...s, speed: v })), []);
  const setPlacementIconId = useCallback((id: string | null) => setState((s) => ({ ...s, placementIconId: id })), []);
  const setExportProgress = useCallback((p: number | null) => setState((s) => ({ ...s, exportProgress: p })), []);
  const announce = useCallback((msg: string) => {
    setState((s) => ({ ...s, announcement: msg }));
    if (announceTimeout.current) window.clearTimeout(announceTimeout.current);
    announceTimeout.current = window.setTimeout(() => {
      setState((s) => ({ ...s, announcement: "" }));
    }, 4000);
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...state,
    setSelected, setActive, setPlaying, setLoop, setSpeed,
    setPlacementIconId, setExportProgress, announce,
  }), [state, setSelected, setActive, setPlaying, setLoop, setSpeed, setPlacementIconId, setExportProgress, announce]);

  return <PlaygroundUIContext.Provider value={value}>{children}</PlaygroundUIContext.Provider>;
}

export function usePlaygroundUI(): Ctx {
  const v = useContext(PlaygroundUIContext);
  if (!v) throw new Error("usePlaygroundUI must be used inside PlaygroundUIProvider");
  return v;
}
