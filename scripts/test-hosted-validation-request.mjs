import assert from "node:assert/strict";
import test from "node:test";
import { hostedValidationRequest } from "./hosted-validation-request.mjs";

const body = { artifact: { format: "bicep", code: "INVALID {{{" } };
test("every hosted fixture, including invalid Bicep, retries temporary validator unavailability", async () => {
  let calls = 0;
  const reports = [];
  const waits = [];
  const result = await hostedValidationRequest(async () => ++calls === 1
    ? Response.json({ code: "timeout" }, { status: 503 })
    : Response.json({ validation: { status: "failed" } }), body, "test", {
    wait: async (ms) => { waits.push(ms); }, report: (message) => reports.push(message),
  });
  assert.equal(calls, 2);
  assert.equal(result.validation.status, "failed");
  assert.deepEqual(waits, [5000]);
  assert.match(reports[0], /HTTP 503, code timeout.*not a validation pass/);
});

test("persistent unavailability remains a failed deployment gate", async () => {
  let calls = 0;
  await assert.rejects(hostedValidationRequest(async () => {
    calls++;
    return Response.json({ code: "unavailable" }, { status: 503 });
  }, body, "test", { attempts: 3, wait: async () => {}, report: () => {} }), /HTTP 503, code unavailable, attempt 3\/3/);
  assert.equal(calls, 3);
});

test("authentication errors and successful semantic failures are not retried or converted to success", async () => {
  let calls = 0;
  await assert.rejects(hostedValidationRequest(async () => {
    calls++;
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }, body, "test"), /HTTP 401/);
  assert.equal(calls, 1);
  const result = await hostedValidationRequest(async () => Response.json({ validation: { status: "needs-review" } }), body, "test");
  assert.equal(result.validation.status, "needs-review");
});
