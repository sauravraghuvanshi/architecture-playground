import test from "node:test";
import assert from "node:assert/strict";
import { syncReviewAgent, syncDeploymentAgent, reviewAgentInstructions } from "./sync-review-agent.mjs";
import { DEPLOYMENT_AGENT_INSTRUCTIONS } from "../lib/deployment-assistance.ts";

function harness(instructions = "old contract", tools = []) {
  const original = { name: "review", version: "1", definition: { kind: "prompt", model: "existing-model", instructions, tools, text: { format: { type: "json_object" } }, temperature: 0.2 } };
  let created;
  const project = { agents: {
    getVersion: async (_name, version) => version === "1" ? original : created,
    createVersion: async (name, definition) => { created = { name, version: "2", definition }; return created; },
  } };
  return { project, original, get created() { return created; } };
}

test("agent synchronization detects stale hosted schema and is read-only unless explicitly applied", async () => {
  const h = harness();
  const result = await syncReviewAgent({ project: h.project, name: "review", version: "1" });
  assert.equal(result.changed, true);
  assert.equal(result.applied, false);
  assert.equal(h.created, undefined);
});
test("agent synchronization preserves model, response format, tools and settings while updating the exact contract", async () => {
  const h = harness();
  const result = await syncReviewAgent({ project: h.project, name: "review", version: "1", apply: true });
  assert.equal(result.version, "2");
  assert.equal(result.applied, true);
  assert.deepEqual(h.created.definition, { ...h.original.definition, instructions: reviewAgentInstructions });
  assert.match(h.created.definition.instructions, /guidanceIds/);
  assert.match(h.created.definition.instructions, /guidanceRationale/);
});
test("matching schemas are idempotent and unexpected tools block synchronization", async () => {
  const h = harness(reviewAgentInstructions);
  assert.equal((await syncReviewAgent({ project: h.project, name: "review", version: "1", apply: true })).applied, false);
  const tools = harness("old", [{ type: "code_interpreter" }]);
  await assert.rejects(syncReviewAgent({ project: tools.project, name: "review", version: "1", apply: true }), /has tools/);
  assert.equal(tools.created, undefined);
});

test("deployment synchronization retains the model while installing audited service-readiness and validation instructions", async () => {
  const h = harness();
  const report = await syncDeploymentAgent({ project: h.project, name: "deployment", version: "1", apply: true });
  assert.equal(report.applied, true);
  assert.equal(h.created.definition.instructions, DEPLOYMENT_AGENT_INSTRUCTIONS);
  assert.equal(h.created.definition.model, h.original.definition.model);
  assert.match(h.created.definition.instructions, /serviceReadiness/);
});
