/**
 * Animation engine — drives sequence playback by writing into the ephemeral
 * UI context (activeNodeIds / activeEdgeIds). Does NOT mutate the persisted
 * graph; nodes/edges read these via context for highlighting.
 */
"use client";

import { useEffect, useRef, useMemo } from "react";
import { normalizeSequence, type NormalizedSequence } from "../lib/sequence";
import type { PlaygroundEdge } from "../lib/types";
import { usePlaygroundUI } from "../PlaygroundUIContext";

const FRAME_MS_BASE = 900;     // base duration per frame at 1x speed
const IDLE_MS_BASE = 350;      // idle frame between loop end and restart

export function useSequencePlayer(edges: PlaygroundEdge[]) {
  const { isPlaying, setPlaying, loop, speed, setActive } = usePlaygroundUI();
  const seq = useMemo(() => normalizeSequence(edges), [edges]);
  const seqRef = useRef<NormalizedSequence>(seq);

  useEffect(() => {
    seqRef.current = seq;
  }, [seq]);

  useEffect(() => {
    if (!isPlaying) return;
    if (seqRef.current.totalSteps === 0) {
      setPlaying(false);
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let frameIdx = 0;

    const tick = () => {
      if (cancelled) return;
      const seq = seqRef.current;
      if (seq.totalSteps === 0) { setPlaying(false); return; }

      // End of sequence?
      if (frameIdx >= seq.frames.length) {
        if (!loop) {
          setActive([], []);
          setPlaying(false);
          return;
        }
        // Idle frame between loops
        setActive([], []);
        timeoutId = window.setTimeout(() => {
          frameIdx = 0;
          tick();
        }, IDLE_MS_BASE / Math.max(speed, 0.25));
        return;
      }

      const frame = seq.frames[frameIdx];
      setActive(frame.activeNodeIds, frame.edgeIds);
      frameIdx++;
      timeoutId = window.setTimeout(tick, FRAME_MS_BASE / Math.max(speed, 0.25));
    };

    tick();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      setActive([], []);
    };
  }, [isPlaying, loop, speed, setActive, setPlaying]);

  return { totalSteps: seq.totalSteps };
}
