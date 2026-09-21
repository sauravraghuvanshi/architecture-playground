export interface SseEvent {
  data: string;
}

export interface ConsumeSseOpts {
  signal?: AbortSignal;
  onEvent: (event: SseEvent) => void;
  onHeartbeat?: () => void;
  maxEventChars?: number;
  maxBytes?: number;
  timeoutMs?: number;
}

export async function consumeSseResponse(res: Response, opts: ConsumeSseOpts): Promise<void> {
  if (!res.body || res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/event-stream") {
    if (res.body) void res.body.cancel().catch(() => {});
    throw new Error("Expected an event-stream response.");
  }
  const maxEventChars = opts.maxEventChars ?? 7_100_000;
  const maxBytes = opts.maxBytes ?? 8_000_000;
  const timeoutMs = opts.timeoutMs ?? 285_000;
  if (![maxEventChars, maxBytes, timeoutMs].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("Stream limits must be positive integers.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let line = "";
  let dataLines: string[] = [];
  let eventChars = 0;
  let bytes = 0;
  let afterCR = false;
  let heartbeat = false;
  let completed = false;
  let cancelRead: (error: Error) => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => { cancelRead = reject; });
  const abort = () => cancelRead(opts.signal?.reason instanceof Error ? opts.signal.reason : new DOMException("Cancelled", "AbortError"));
  const timeout = setTimeout(() => cancelRead(new DOMException("Image stream timed out. Retry when the service is available.", "TimeoutError")), timeoutMs);

  function dispatchLine() {
    if (!line) {
      if (dataLines.length) opts.onEvent({ data: dataLines.join("\n") });
      else if (heartbeat) opts.onHeartbeat?.();
      dataLines = [];
      heartbeat = false;
      eventChars = 0;
    } else {
      eventChars += line.length + 1;
      if (eventChars > maxEventChars) throw new Error("Event stream exceeded the event size limit.");
      if (line.startsWith(":")) heartbeat = true;
      else if (line === "data") dataLines.push("");
      else if (line.startsWith("data:")) {
        const value = line.slice(5);
        dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
      }
    }
    line = "";
  }

  function consume(text: string) {
    let start = 0;
    for (let index = 0; index < text.length; index++) {
      const character = text[index];
      if (afterCR && character === "\n") {
        afterCR = false;
        start = index + 1;
        continue;
      }
      afterCR = false;
      if (character !== "\r" && character !== "\n") continue;
      line += text.slice(start, index);
      dispatchLine();
      afterCR = character === "\r";
      start = index + 1;
    }
    line += text.slice(start);
    if (line.length + eventChars > maxEventChars) throw new Error("Event stream exceeded the event size limit.");
  }

  try {
    opts.signal?.throwIfAborted();
    opts.signal?.addEventListener("abort", abort, { once: true });
    while (true) {
      const { value, done } = await Promise.race([reader.read(), cancelled]);
      opts.signal?.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("Event stream exceeded the total size limit.");
      consume(decoder.decode(value, { stream: true }));
    }
    consume(decoder.decode());
    if (line || eventChars || dataLines.length) throw new Error("Image stream was truncated before a complete event boundary.");
    completed = true;
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener("abort", abort);
    // Do not let a stalled source's cancel promise delay cancellation or mask a
    // validation/transport error. releaseLock rejects any still-pending read.
    if (!completed) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
