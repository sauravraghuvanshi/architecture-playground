/**
 * Tiny Server-Sent Events client for `fetch`-based POST endpoints.
 *
 * Browsers' native `EventSource` only supports GET, so any SSE response
 * driven by a POST (e.g. /api/ai/image with a JSON prompt body) needs a
 * manual reader on top of the fetch ReadableStream. This module:
 *
 *  - parses `data:` lines into JSON payloads (each blank-line-delimited
 *    block is a single event)
 *  - swallows comment lines (`:` prefix) but exposes them as heartbeat
 *    callbacks so the UI can display "still alive after Ns" progress
 *  - preserves partial chunks across reads (UTF-8-safe via
 *    TextDecoder({ stream: true }))
 *  - honours an external AbortSignal so callers can cancel
 *
 * Designed for the protocol emitted by /api/ai/image:
 *   ': hb <ts>\n\n'                                  ← heartbeat
 *   'data: {"type":"started","elapsed":0}\n\n'
 *   'data: {"type":"result","b64":"...","size":...}\n\n'
 *   'data: {"type":"error","message":"...","status":N}\n\n'
 */

export interface SseEvent {
  data: string;
}

export interface ConsumeSseOpts {
  signal?: AbortSignal;
  onEvent: (event: SseEvent) => void;
  onHeartbeat?: () => void;
}

export async function consumeSseResponse(res: Response, opts: ConsumeSseOpts): Promise<void> {
  if (!res.body) throw new Error("Response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  const flushBlock = (block: string) => {
    // A block is one event; concatenate any "data:" lines.
    const dataLines: string[] = [];
    let sawHeartbeat = false;
    for (const raw of block.split("\n")) {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (line.length === 0) continue;
      if (line.startsWith(":")) { sawHeartbeat = true; continue; }
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      // event:/id:/retry: lines are recognised by spec but unused here.
    }
    if (sawHeartbeat && dataLines.length === 0) {
      opts.onHeartbeat?.();
      return;
    }
    if (dataLines.length > 0) {
      opts.onEvent({ data: dataLines.join("\n") });
    }
  };

  try {
    while (true) {
      if (opts.signal?.aborted) {
        try { await reader.cancel(); } catch { /* already closed */ }
        throw new DOMException("aborted", "AbortError");
      }
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE events are delimited by a blank line (\n\n). Process all
      // complete blocks; keep the trailing partial in `buf` for the next read.
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        flushBlock(block);
      }
    }
    // Flush any tail (no trailing blank line).
    if (buf.trim().length > 0) flushBlock(buf);
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}
