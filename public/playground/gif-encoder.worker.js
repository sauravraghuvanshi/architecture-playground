/* eslint-disable */
/**
 * Web Worker: encodes GIF frames using gifenc.
 * Communicates with main thread via postMessage:
 *   { type:"init", width, height, fps }
 *   { type:"frame", index, data:ArrayBuffer (RGBA), width, height }
 *   { type:"finalize" }   → posts { type:"done", buffer }
 */

importScripts("/playground/gifenc.bundle.js");

let gif = null;
let palette = null;
let delayMs = 100;
let w = 0, h = 0;

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      w = m.width; h = m.height;
      delayMs = Math.round(1000 / Math.max(1, m.fps));
      gif = self.gifenc.GIFEncoder();
    } else if (m.type === "frame") {
      const rgba = new Uint8ClampedArray(m.data);
      // Build a 256-color palette from the first frame, reuse for all (smaller, faster).
      if (!palette) {
        palette = self.gifenc.quantize(rgba, 256, { format: "rgba4444" });
      }
      const indexed = self.gifenc.applyPalette(rgba, palette, "rgba4444");
      gif.writeFrame(indexed, w, h, { palette: m.index === 0 ? palette : undefined, delay: delayMs });
    } else if (m.type === "finalize") {
      gif.finish();
      const buffer = gif.bytesView().buffer.slice(0);
      self.postMessage({ type: "done", buffer }, [buffer]);
      gif = null; palette = null;
    }
  } catch (err) {
    self.postMessage({ type: "error", error: String(err && err.message || err) });
  }
};
