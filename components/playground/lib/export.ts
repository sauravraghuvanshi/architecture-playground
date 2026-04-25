/**
 * Export helpers: PNG (single image), JSON (download), GIF (animated loop
 * recorded by stepping through sequence frames + capturing each).
 *
 * GIF capture pipeline:
 *  1. Caller pauses live playback and provides a step driver: setActive(idx).
 *  2. We iterate frames at the chosen fps, calling setActive then awaiting
 *     two RAFs (so React commits + paint happens) then snapshotting via
 *     html-to-image.toCanvas → ImageData.
 *  3. Frames stream into a Web Worker that runs gifenc.
 *  4. Worker returns the .gif as ArrayBuffer → Blob → trigger download.
 *
 * Caps: max 96 frames @ 12fps = 8s loop.
 */
"use client";

import { toPng, toCanvas } from "html-to-image";
import type { PlaygroundGraph } from "./types";
import { CURRENT_SCHEMA_VERSION } from "./types";

interface DownloadOptions { filename: string; }

export async function exportPng(viewportEl: HTMLElement, opts: DownloadOptions = { filename: "architecture.png" }) {
  const dataUrl = await toPng(viewportEl, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    filter: (node) => {
      // Skip React Flow chrome (controls, minimap, attribution)
      if (!(node instanceof Element)) return true;
      if (node.classList?.contains("react-flow__minimap")) return false;
      if (node.classList?.contains("react-flow__controls")) return false;
      if (node.classList?.contains("react-flow__attribution")) return false;
      return true;
    },
  });
  triggerDownload(dataUrl, opts.filename);
}

export function exportJson(graph: PlaygroundGraph, opts: DownloadOptions = { filename: "architecture.json" }) {
  const payload = JSON.stringify({ version: CURRENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), graph }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, opts.filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  ok: boolean;
  graph?: PlaygroundGraph;
  errors?: string[];
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

export interface GifFrameDriver {
  totalFrames: number;
  setFrame: (frameIdx: number) => Promise<void>; // updates UI to show frame idx; resolves after paint
}

interface GifExportOptions {
  fps?: number;        // 8 | 12 | 15
  scale?: number;      // 1 | 1.5
  filename?: string;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

const MAX_FRAMES = 96;

/**
 * Record an animated GIF by stepping the driver through frames.
 * The encoder runs in a Web Worker (public/playground/gif-encoder.worker.js).
 */
export async function exportGif(
  viewportEl: HTMLElement,
  driver: GifFrameDriver,
  opts: GifExportOptions = {}
): Promise<void> {
  const { fps = 12, scale = 1, filename = "architecture.gif", onProgress, signal } = opts;
  const totalFrames = Math.min(driver.totalFrames, MAX_FRAMES);
  if (totalFrames === 0) throw new Error("No frames to capture — set steps on edges first.");

  // Eagerly render once to learn dimensions (also primes asset loading).
  const probeCanvas = await toCanvas(viewportEl, { pixelRatio: scale, cacheBust: true });
  const width = probeCanvas.width;
  const height = probeCanvas.height;

  const worker = new Worker("/playground/gif-encoder.worker.js");
  let resolveDone!: () => void;
  let rejectDone!: (e: Error) => void;
  const done = new Promise<void>((res, rej) => { resolveDone = res; rejectDone = rej; });

  worker.onmessage = (ev: MessageEvent) => {
    const msg = ev.data as { type: string; buffer?: ArrayBuffer; error?: string };
    if (msg.type === "done" && msg.buffer) {
      const blob = new Blob([msg.buffer], { type: "image/gif" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, filename);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      worker.terminate();
      resolveDone();
    } else if (msg.type === "error") {
      worker.terminate();
      rejectDone(new Error(msg.error || "GIF encoder failed"));
    }
  };
  worker.onerror = (e) => {
    worker.terminate();
    rejectDone(new Error(e.message || "GIF encoder worker error"));
  };

  worker.postMessage({ type: "init", width, height, fps });

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) throw new Error("Cancelled");
      await driver.setFrame(i);
      // Wait two RAFs so React commits + browser paints before snapshot.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const canvas = await toCanvas(viewportEl, { pixelRatio: scale, cacheBust: false, width, height });
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      const imgData = ctx.getImageData(0, 0, width, height);
      // Transfer the pixel buffer to the worker (zero-copy).
      worker.postMessage(
        { type: "frame", index: i, data: imgData.data.buffer, width, height },
        [imgData.data.buffer]
      );
      onProgress?.((i + 1) / totalFrames);
    }
    worker.postMessage({ type: "finalize" });
    await done;
  } catch (err) {
    worker.terminate();
    throw err;
  }
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
