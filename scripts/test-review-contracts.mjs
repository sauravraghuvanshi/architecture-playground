import assert from "node:assert/strict";
import test from "node:test";
import {
  parseArchitectureReview, parseGeneratedArchitectureReview, generateArchitectureReview,
  architectureReviewRequestSchema, ARCHITECTURE_REVIEW_MAX_RESPONSE_BYTES,
  ARCHITECTURE_REVIEW_JSON_SCHEMA,
} from "../lib/architecture-review.ts";
import { legacyReviewRequestSchema, REVIEW_EVIDENCE_MAX_BYTES } from "../lib/review-evidence.ts";
import { readBoundedJson, RequestBodyError } from "../lib/request-json.ts";
import { REVIEW_GUIDANCE, REVIEW_GUIDANCE_VERSION } from "../lib/review-guidance.ts";

const finding = {
  id: "recovery", title: "Confirm recovery objectives", severity: "high",
  framework: "Well-Architected Framework", sourceUrl: "https://learn.microsoft.com/azure/well-architected/reliability/redundancy",
  guidanceIds: ["waf-redundancy"], guidanceRationale: "The critical flow needs agreed recovery targets before choosing redundant capacity.",
  evidence: "Recovery objectives were not supplied.", recommendation: "Agree and test recovery objectives.",
  evidenceStatus: "unknown", nodeIds: [], edgeIds: [],
  remediation: { steps: ["Agree objectives.", "Test recovery."], validation: "Measure recovery time and data loss.", tradeoff: "Additional recovery capacity has cost." },
};
const review = { summary: "Recovery requires confirmation.", score: 60, posture: "mixed", strengths: [], assumptions: ["Deployed configuration is unverified."], findings: [finding] };
const parse = (value, payload) => parseGeneratedArchitectureReview(JSON.stringify(value), payload);

test("new reviews require complete remediation and explicit evidence; historical reads do not fabricate fields", () => {
  assert.deepEqual(parse(review), review);
  for (const field of ["evidenceStatus", "nodeIds", "edgeIds", "remediation", "guidanceIds", "guidanceRationale"]) {
    const old = structuredClone(review);
    delete old.findings[0][field];
    assert.throws(() => parse(old), field);
    assert.equal(field in parseArchitectureReview(JSON.stringify(old)).findings[0], false);
  }
  for (const field of ["steps", "validation", "tradeoff"]) {
    const invalid = structuredClone(review);
    delete invalid.findings[0].remediation[field];
    assert.throws(() => parse(invalid));
  }
});

test("duplicate findings, references, blank evidence and framework/source mismatches fail atomically", () => {
  assert.throws(() => parse({ ...review, findings: [finding, finding] }), /unique/);
  for (const patch of [
    { id: "   " }, { evidence: " " }, { recommendation: "\n" },
    { sourceUrl: "https://learn.microsoft.com/azure/architecture/" },
    { sourceUrl: "https://learn.microsoft.com/azure/well-architected/" },
    { guidanceIds: ["invented-source"] },
    { guidanceIds: ["aac-retry"] },
    { guidanceIds: ["waf-redundancy", "waf-redundancy"] },
    { guidanceRationale: " " },
    { nodeIds: ["app", "app"] }, { edgeIds: ["edge", "edge"] },
    { remediation: { ...finding.remediation, steps: [" "] } },
  ]) assert.throws(() => parse({ ...review, findings: [{ ...finding, ...patch }] }));
});

test("all four guidance families use specific versioned source cards and model grounding cannot be invented", () => {
  assert.equal(REVIEW_GUIDANCE.length, 12);
  assert.equal(new Set(REVIEW_GUIDANCE.map(({ id }) => id)).size, REVIEW_GUIDANCE.length);
  assert.equal(new Set(REVIEW_GUIDANCE.map(({ framework }) => framework)).size, 4);
  const branches = ARCHITECTURE_REVIEW_JSON_SCHEMA.properties.findings.items.allOf;
  assert.equal(branches.length, 4);
  for (const branch of branches) {
    const framework = branch.if.properties.framework.const;
    assert.deepEqual(branch.then.properties.guidanceIds.items.enum, REVIEW_GUIDANCE.filter((item) => item.framework === framework).map((item) => item.id));
  }
  assert.match(REVIEW_GUIDANCE_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  for (const guide of REVIEW_GUIDANCE) {
    const url = new URL(guide.url);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "learn.microsoft.com");
    for (const value of [guide.summary, guide.applicability, guide.validationEvidence]) assert.ok(value.length > 30);
    const generated = { ...review, findings: [{
      ...finding, framework: guide.framework, sourceUrl: guide.url,
      guidanceIds: [guide.id], guidanceRationale: "The submitted evidence has an explicit discovery gap addressed by this guidance.",
    }] };
    assert.equal(parse(generated).findings[0].guidanceIds[0], guide.id);
  }
  assert.throws(() => parse({ ...review, provenance: { runtimeVerified: true } }), /Unrecognized/);
});
test("observed structured findings require exact diagram references while images cannot invent IDs", () => {
  const observed = { ...review, findings: [{ ...finding, evidenceStatus: "observed" }] };
  const payload = { nodes: [{ id: "app" }], edges: [] };
  assert.throws(() => parse(observed, payload), /at least one/);
  const grounded = { ...observed, findings: [{ ...observed.findings[0], nodeIds: ["app"] }] };
  assert.deepEqual(parse(grounded, payload), grounded);
  assert.throws(() => parse(grounded), /exact/);
  assert.deepEqual(parse(observed), observed);
});

test("complete legacy evidence beyond 30k is preserved and explicit limits never crop it", () => {
  const payload = { metadata: { description: "a".repeat(40_000) + "TAIL-MARKER" }, nodes: [{ id: "n", label: "Original" }], edges: [] };
  assert.deepEqual(legacyReviewRequestSchema.parse({ graph: payload }).graph, payload);
  const over = { ...payload, metadata: { description: "x".repeat(REVIEW_EVIDENCE_MAX_BYTES) } };
  assert.equal(legacyReviewRequestSchema.safeParse({ graph: over }).success, false);
  for (const invalid of [
    { nodes: [{ id: "same" }, { id: "same" }], edges: [] },
    { nodes: [{}], edges: [] },
    { nodes: [{ id: "n" }], edges: [{ id: "e", source: "n", target: "missing" }] },
  ]) assert.equal(architectureReviewRequestSchema.safeParse({ source: "canvas", payload: invalid }).success, false);
  assert.equal(architectureReviewRequestSchema.safeParse({ source: "description", description: "Valid text", payload }).success, false);
  let deep = { value: "leaf" };
  for (let index = 0; index < 40; index++) deep = { value: deep };
  assert.equal(legacyReviewRequestSchema.safeParse({ graph: { nodes: [{ id: "n", metadata: deep }], edges: [] } }).success, false);
  assert.equal(legacyReviewRequestSchema.safeParse({ graph: { nodes: [{ id: "n", x: Infinity }], edges: [] } }).success, false);
});

test("correction keeps the complete bounded prior response and rejects oversized output without a second call", async () => {
  const long = " ".repeat(35_000) + JSON.stringify({ ...review, findings: [{ ...finding, id: "" }] });
  let calls = 0;
  const result = await generateArchitectureReview("Evidence", async (messages) => {
    if (++calls === 1) return long;
    assert.equal(messages[2].content, long);
    assert.match(messages[3].content, /Preserve all distinct findings/);
    return JSON.stringify(review);
  });
  assert.deepEqual(result, review);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(generateArchitectureReview("Evidence", async () => {
    calls++; return " ".repeat(ARCHITECTURE_REVIEW_MAX_RESPONSE_BYTES + 1);
  }), /No partial|no partial/);
  assert.equal(calls, 1);
});

test("invalid UTF-8 JSON is rejected without silently replacing source bytes", async () => {
  const request = new Request("http://localhost/fixture", {
    method: "POST", body: new Uint8Array([123, 34, 120, 34, 58, 34, 0xff, 34, 125]),
  });
  await assert.rejects(readBoundedJson(request, 100), (error) => error instanceof RequestBodyError && error.status === 400 && /UTF-8/.test(error.message));
});
