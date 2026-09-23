import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGoldenBenchmark } from "./fixtures/ai-quality-cases.mjs";
import { goldenDatasetSchema } from "../lib/ai-evaluation-contract.ts";
import { evaluateAiCandidate } from "../lib/ai-evaluation.ts";
import { referenceCandidate, runAiEvaluation, readEvaluationJson } from "./evaluate-ai.mjs";
import { aiSubjectFingerprint } from "./ai-evaluation-subjects.mjs";
import { reviewHash } from "../lib/review-provenance-server.ts";

const loaded = await loadGoldenBenchmark();
const dataset = goldenDatasetSchema.parse(loaded.dataset);
const subject = aiSubjectFingerprint().fingerprint;
const makeCandidate = () => referenceCandidate(dataset, loaded.referenceOutputs, subject);

test("versioned benchmark has sixteen deterministic tasks and real conversion evidence", async () => {
  assert.equal(dataset.id, "diagrammatic-cloud-ai");
  assert.equal(dataset.tasks.length, 16);
  for (const kind of ["generation", "conversion", "review", "iac"]) {
    assert.equal(dataset.tasks.filter((task) => task.kind === kind).length, 4);
  }
  assert.deepEqual([...new Set(dataset.tasks.filter((task) => task.kind === "iac").map((task) => task.expected.format))].sort(), ["bicep", "terraform"]);
  const repeated = await loadGoldenBenchmark();
  assert.equal(reviewHash(repeated.dataset), reviewHash(dataset));
  assert.equal(reviewHash(repeated.referenceOutputs), reviewHash(loaded.referenceOutputs));
  for (const task of dataset.tasks.filter((task) => task.kind === "conversion")) {
    assert.match(task.input.image.dataUrl, /^data:image\/png;base64,/);
    assert.ok(Buffer.from(task.input.image.dataUrl.split(",")[1], "base64").length > 1000);
  }
});

test("all golden references pass actual validators without calling any model or qualifying one", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Reference evaluation must never invoke a provider."); };
  try {
    const report = await evaluateAiCandidate(dataset, makeCandidate(), subject);
    assert.equal(report.status, "passed-declared-task-checks", JSON.stringify(report.results));
    assert.equal(report.passedTasks, 16);
    assert.equal(report.eligibleForSubjectPromotion, false);
    assert.equal(report.liveModelInvoked, false);
    assert.ok(report.promotionBlockers.some((reason) => reason.includes("Reference fixtures")));
  } finally { globalThis.fetch = previous; }
});

for (const kind of ["generation", "conversion", "review", "iac"]) {
  test(`independent golden expectations detect a meaningful ${kind} mutation`, async () => {
    const input = makeCandidate();
    const task = dataset.tasks.find((task) => task.kind === kind && (kind !== "iac" || task.expected.format === "bicep"));
    assert.ok(task);
    const entry = input.cases.find((entry) => entry.taskId === task.id);
    if (kind === "generation") entry.output.graph.edges[0].data.label = "Incorrect protocol";
    else if (kind === "conversion") {
      const edge = entry.output.payload.edges[0];
      [edge.source, edge.target] = [edge.target, edge.source];
    } else if (kind === "review") {
      for (const finding of entry.output.review.findings) finding.evidenceStatus = "observed";
    } else entry.output.code = "param location string = 'westeurope'";
    const report = await evaluateAiCandidate(dataset, input, subject);
    assert.equal(report.status, "failed-declared-task-checks");
    assert.equal(report.results.find((result) => result.taskId === task.id).passed, false);
    assert.equal(report.eligibleForSubjectPromotion, false);
  });
}

test("input export omits answers and supplies exact hashes and review contract headers", async () => {
  const directory = mkdtempSync(join(tmpdir(), "diagrammatic-eval-inputs-"));
  try {
    const output = join(directory, "requests.json");
    await runAiEvaluation(["--export-inputs", output]);
    const exported = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(exported.tasks.length, 16);
    assert.equal(exported.dataset.sha256, reviewHash(dataset));
    assert.equal(exported.subject.fingerprint, subject);
    for (const item of exported.tasks) {
      assert.equal(item.expected, undefined);
      assert.equal(item.referenceOutput, undefined);
      assert.equal(item.inputSha256, reviewHash(item.input));
      if (item.kind === "review") assert.equal(item.request.headers["X-Diagrammatic-Review-Contract"], "2");
    }
    writeFileSync(join(directory, "invalid.json"), new Uint8Array([0xff]));
    assert.throws(() => readEvaluationJson(join(directory, "invalid.json")), /valid UTF-8/);
    writeFileSync(join(directory, "invalid.json"), '{"confidential":"must-not-be-printed"');
    assert.throws(() => readEvaluationJson(join(directory, "invalid.json")), (error) => {
      assert.doesNotMatch(error.message, /confidential|must-not-be-printed/);
      return /complete JSON/.test(error.message);
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
