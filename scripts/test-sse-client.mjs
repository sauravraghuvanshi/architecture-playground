import assert from "node:assert/strict";
import test from "node:test";
import { consumeSseResponse } from "../lib/sse-client.ts";

const encoder = new TextEncoder();
function response(chunks, cancelled = () => {}) {
  return new Response(new ReadableStream({
    start(controller) { for (const chunk of chunks) controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk); controller.close(); },
    cancel: cancelled,
  }), { headers: { "content-type": "text/event-stream" } });
}

for (const separator of ["\n", "\r\n", "\r"]) {
  test(`SSE accepts ${JSON.stringify(separator)} across every UTF-8 byte boundary`, async () => {
    const bytes = encoder.encode(`: heartbeat${separator}${separator}data: {"label":"é"}${separator}data:  leading${separator}${separator}`);
    const events = [];
    let heartbeats = 0;
    await consumeSseResponse(response([...bytes].map((byte) => Uint8Array.of(byte))), {
      onEvent: ({ data }) => events.push(data), onHeartbeat: () => heartbeats++,
    });
    assert.deepEqual(events, ['{"label":"é"}\n leading']);
    assert.equal(heartbeats, 1);
  });
}

test("SSE does not dispatch a truncated final event without its blank-line boundary", async () => {
  const events = [];
  await assert.rejects(consumeSseResponse(response(['data: {"type":"result"}']), { onEvent: (event) => events.push(event) }), /truncated|incomplete/i);
  assert.deepEqual(events, []);
});

test("SSE rejects invalid UTF-8 and non-event-stream responses", async () => {
  await assert.rejects(consumeSseResponse(response([Uint8Array.of(0xff)]), { onEvent() {} }));
  await assert.rejects(consumeSseResponse(Response.json({ error: "not SSE" }), { onEvent() {} }), /event-stream/i);
});

test("cancellation settles a pending read immediately and cancels its source", async () => {
  let release;
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { release = controller; }, cancel() { cancelled = true; } });
  const controller = new AbortController();
  const pending = consumeSseResponse(new Response(stream, { headers: { "content-type": "text/event-stream" } }), { signal: controller.signal, onEvent() { assert.fail("cancelled data"); } });
  const observed = pending.then(() => "resolved", (error) => error.name);
  controller.abort();
  const outcome = await Promise.race([observed, new Promise((resolve) => setTimeout(() => resolve("pending"), 100))]);
  if (!cancelled) release.close();
  await observed;
  assert.equal(outcome, "AbortError");
  assert.equal(cancelled, true);
});

test("SSE bounds event and total buffering and enforces an absolute timeout", async () => {
  await assert.rejects(consumeSseResponse(response(["data: " + "x".repeat(50) + "\n\n"]), { maxEventChars: 20, onEvent() {} }), /limit|large/i);
  await assert.rejects(consumeSseResponse(response([": " + "x".repeat(50) + "\n\n"]), { maxBytes: 20, onEvent() {} }), /limit|large/i);
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(consumeSseResponse(new Response(stream, { headers: { "content-type": "text/event-stream" } }), { timeoutMs: 20, onEvent() {} }), /timed out/i);
  assert.equal(cancelled, true);
});
