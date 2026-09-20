import assert from "node:assert/strict";
import test from "node:test";
import { deployZip } from "./deploy-zip.mjs";

const input = { endpoint: "https://fixture.scm.azurewebsites.net/api/zipdeploy", username: "fixture", password: "not-a-real-credential", uploadBody: new Uint8Array([1]) };
test("async ZIP deployment waits for its returned operation rather than a healthy old application", async () => {
  const states = [0, 1, 2, 4];
  const calls = [];
  let now = 0;
  const result = await deployZip({
    ...input, now: () => now, wait: async (ms) => { now += ms; },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), method: options.method });
      if (options.method === "POST") return new Response(null, { status: 202, headers: { Location: "/api/deployments/operation-1" } });
      return Response.json({ id: "operation-1", status: states.shift(), complete: states.length === 0 });
    },
  });
  assert.equal(result.status, "completed");
  assert.equal(calls.length, 5);
  assert.ok(calls.slice(1).every((call) => call.url.endsWith("/api/deployments/operation-1")));
  assert.equal(now, 15000);
});

test("deployment failure, timeout and foreign status URLs cannot become success", async () => {
  for (const scenario of ["failed", "timeout", "foreign", "missing"]) {
    let now = 0;
    const pending = deployZip({
      ...input, timeoutMs: 6000, now: () => now, wait: async (ms) => { now += ms; },
      fetchImpl: async (_url, options) => {
        if (options.method === "POST") return new Response(null, {
          status: 202, headers: scenario === "missing" ? {} : { Location: scenario === "foreign" ? "https://example.invalid/status" : "/api/deployments/op" },
        });
        return Response.json({ status: scenario === "failed" ? 3 : 2 });
      },
    });
    await assert.rejects(pending, /failure|bounded wait|outside|did not return/);
  }
});
