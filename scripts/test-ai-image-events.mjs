import assert from "node:assert/strict";
import test from "node:test";
import { consumeImageResponse } from "../lib/ai-image-events.ts";
const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgqLjyHwAEFAJMURtfXQAAAABJRU5ErkJggg==";
const result = { type: "result", b64, size: "1024x1024" };
const response = (events) => new Response(events.map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });

test("one complete insertable image preserves bytes and declares a validated MIME type", async () => {
  const parsed = await consumeImageResponse(response([{ type: "started", elapsed: 0 }, result]));
  assert.equal(parsed.b64, b64);
  assert.equal(parsed.mimeType, "image/png");
});

test("invalid, multiple, missing and URL-only terminal results cannot be inserted", async () => {
  for (const events of [
    [result, result],
    [result, { type: "error", status: 429 }],
    [{ type: "error", status: 429 }, result],
    ['{broken', result],
    [{ type: "started" }],
    [{ type: "result", url: "https://external.invalid/image.png" }],
    [{ ...result, b64: "aGVsbG8=" }],
    [{ type: "started" }, { type: "started" }, result],
  ]) await assert.rejects(consumeImageResponse(response(events)));
});

for (const [code, expected] of [
  ["timeout", /timed out/], ["throttled", /throttled/], ["refused", /content policy/],
  ["invalid_output", /invalid image/], ["unavailable", /unavailable/], ["upstream", /could not complete/],
]) {
  test(`image outcome ${code} is distinct and never leaks upstream diagnostics`, async () => {
    await assert.rejects(consumeImageResponse(response([{ type: "error", code, status: 502, message: "PRIVATE_DIAGNOSTIC" }])), (error) => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /PRIVATE/);
      return true;
    });
  });
}
