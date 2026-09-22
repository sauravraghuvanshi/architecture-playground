import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { reviewResponse } from "./review-fixture";
import { reviewHash } from "../lib/review-provenance-server";

const valid = {
  summary: "Recovery evidence needs confirmation.", posture: "mixed", score: 60,
  strengths: ["Managed service intent is visible."], assumptions: ["Runtime configuration is unverified."],
  findings: [{
    id: "recovery", title: "Confirm recovery objectives", severity: "high",
    framework: "Well-Architected Framework", sourceUrl: "https://learn.microsoft.com/azure/well-architected/reliability/redundancy",
    guidanceIds: ["waf-redundancy"], guidanceRationale: "Recovery targets are needed to decide redundancy for the depicted workload.",
    evidence: "No tested recovery objective was supplied.", recommendation: "Agree and test recovery.",
    evidenceStatus: "unknown", nodeIds: [], edgeIds: [],
    remediation: { steps: ["Agree objectives.", "Rehearse recovery."], validation: "Measure achieved recovery time.", tradeoff: "Recovery capacity costs more." },
  }],
};

async function openReview(page: Page) {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { configured: true, diagramConfigured: true, imageConfigured: false, reviewAgentConfigured: true, deploymentAgentConfigured: false } }));
  await page.goto("/diagrammatic?mode=architecture");
  await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Review my architecture", exact: true });
  await modal.getByRole("button", { name: "Describe", exact: true }).click();
  await modal.getByRole("textbox", { name: "Architecture description", exact: true }).fill("Synthetic App Service workload; no runtime proof supplied.");
  return modal;
}

test("UI rejects partial, duplicated and mismatched-source reviews instead of presenting success", async ({ page }) => {
  const missing = structuredClone(valid);
  const missingRemediation: Record<string, unknown> = { ...missing.findings[0] };
  delete missingRemediation.remediation;
  const cases = [
    { ...valid, findings: [missingRemediation] },
    { ...valid, findings: [valid.findings[0], valid.findings[0]] },
    { ...valid, findings: [{ ...valid.findings[0], sourceUrl: "https://learn.microsoft.com/azure/architecture/" }] },
    { ...valid, findings: [{ ...valid.findings[0], nodeIds: ["imagined-service"] }] },
    { ...valid, findings: [{ ...valid.findings[0], guidanceIds: ["invented-source"] }] },
    { ...valid, findings: [{ ...valid.findings[0], sourceUrl: "https://learn.microsoft.com/azure/well-architected/" }] },
  ];
  let current = 0;
  await page.route("**/api/ai/review", (route) => route.fulfill({
    json: { ...reviewResponse(valid, route.request().postDataJSON()), review: cases[current++] },
  }));
  const modal = await openReview(page);
  for (let index = 0; index < cases.length; index++) {
    await modal.getByRole("button", { name: "Run Foundry review", exact: true }).click();
    await expect(modal.getByRole("alert")).toBeVisible();
    await expect(modal.getByRole("region", { name: "Your personalized review" })).toHaveCount(0);
  }
  expect(current).toBe(cases.length);
});

test("complete remediation remains visible after a valid bounded response", async ({ page }) => {
  await page.route("**/api/ai/review", (route) => route.fulfill({ json: reviewResponse(valid, route.request().postDataJSON()) }));
  const modal = await openReview(page);
  await modal.getByRole("button", { name: "Run Foundry review", exact: true }).click();
  const result = modal.getByRole("region", { name: "Your personalized review" });
  await expect(result).toContainText("Confirm recovery objectives");
  await expect(result).toContainText("Measure achieved recovery time.");
  await expect(result).toContainText("Recovery capacity costs more.");
  await expect(result).toContainText("Runtime verified: no");
  await expect(result).toContainText("synthetic-model-v1");
  await expect(result.getByRole("region", { name: "Supporting guidance waf-redundancy" })).toContainText("critical flow");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    result.getByRole("button", { name: "Download review JSON", exact: true }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Review package was not downloaded");
  const pack = JSON.parse(await readFile(path, "utf8"));
  expect(pack.provenance.reviewSha256).toBe(reviewHash(pack.review));
  expect(pack.evidence.description).toContain("Synthetic App Service");
  expect(pack.guidance[0].id).toBe("waf-redundancy");
  expect(reviewHash(pack.guidanceSnapshot.entries)).toBe(pack.provenance.guidanceSha256);
  expect(pack.imageBytesIncluded).toBe(false);
});

test("review UI refuses missing, runtime-verified or content-mismatched provenance", async ({ page }) => {
  let attempt = 0;
  await page.route("**/api/ai/review", (route) => {
    const result = reviewResponse(valid, route.request().postDataJSON());
    const cases = [
      { review: valid },
      { ...result, provenance: { ...result.provenance, runtimeVerified: true } },
      { ...result, review: { ...result.review, summary: "Replaced after generation." } },
      { ...result, provenance: { ...result.provenance, evidenceSha256: "f".repeat(64) } },
      { ...result, provenance: { ...result.provenance, guidanceSha256: "f".repeat(64) } },
    ];
    return route.fulfill({ json: cases[attempt++] });
  });
  const modal = await openReview(page);
  for (let index = 0; index < 5; index++) {
    await modal.getByRole("button", { name: "Run Foundry review" }).click();
    await expect(modal.getByRole("alert")).toBeVisible();
    await expect(modal.getByRole("region", { name: "Your personalized review" })).toHaveCount(0);
  }
});
test("real request boundaries reject invalid images and oversized/ambiguous evidence before a provider call", async ({ request }) => {
  for (const image of [
    { name: "empty.png", mimeType: "image/png", dataUrl: "data:image/png;base64," },
    { name: "fake.png", mimeType: "image/png", dataUrl: "data:image/png;base64,c3ludGhldGlj" },
  ]) {
    expect((await request.post("/api/ai/review", { data: { source: "image", image } })).status()).toBe(400);
    expect((await request.post("/api/ai/convert", { data: { image } })).status()).toBe(400);
  }
  for (const body of [
    { graph: { nodes: [{ id: "app" }], edges: [], metadata: { description: "x".repeat(120_000) } } },
    { source: "canvas", payload: { nodes: [{ id: "same" }, { id: "same" }], edges: [] } },
    { source: "description", description: "Synthetic", payload: { nodes: [], edges: [] } },
  ]) expect((await request.post("/api/ai/review", { data: body })).status()).toBe(400);
  const describe = await request.post("/api/ai/describe", { data: { graph: { nodes: [{ id: "app" }], edges: [], metadata: { description: "x".repeat(130_000) } } } });
  expect(describe.status()).toBe(413);
});
