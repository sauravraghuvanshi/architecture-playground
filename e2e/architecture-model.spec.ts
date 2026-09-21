import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { parseArchitectureDocument } from "../lib/architecture-document";
import type { ArchPayload } from "../lib/architecture-model";
import { readCanvasPayload } from "./read-canvas-payload";
import { waitForWorkspace } from "./wait-for-workspace";
import { privacyFixture } from "./ai-privacy-fixture";

test.use({ viewport: { width: 1600, height: 1100 } });
test.describe.configure({ timeout: 90_000 });

const fixture: ArchPayload = {
  metadata: {
    name: "Model acceptance", designIntent: "Keep customer data in Europe.",
    environments: [{ id: "prod", name: "Production" }],
    requirements: [{ id: "residency", category: "compliance", statement: "EU residency", evidenceIds: ["owner"] }],
    evidence: [{ id: "owner", source: "user", summary: "Owner requests EU residency." }],
  },
  nodes: [
    { id: "zone", kind: "group", label: "Landing Zone", tier: "Landing Zone", x: 0, y: 0, width: 500, height: 300 },
    { id: "app", kind: "icon", label: "Payments API", iconId: "azure/application/application-service", iconPath: "/cloud-icons/azure/application/application-service.svg", x: 40, y: 80, parentId: "zone", semantics: { region: "westeurope", sku: "P1v3", environmentId: "prod", requirementIds: ["residency"], evidenceIds: ["owner"] } },
    { id: "client", kind: "shape", shape: "person", label: "Client", x: 640, y: 80, width: 128, height: 104 },
  ],
  edges: [{ id: "request", source: "client", target: "app", label: "HTTPS", style: "solid", step: 1, semantics: { connectionType: "data-flow", protocol: "HTTPS", evidenceIds: ["owner"] } }],
};

async function importGraph(page: Page, payload: unknown) {
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "semantic-architecture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)),
  });
}

async function openFixture(page: Page) {
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await importGraph(page, fixture);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
}

async function exported(page: Page): Promise<ArchPayload> {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"), page.getByRole("button", { name: /^JSON .+re-importable$/ }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Architecture JSON download unavailable.");
  return JSON.parse(await readFile(path, "utf8"));
}

test("versioned context survives Inspector edits, undo/redo, named save, reload and JSON export", async ({ page }) => {
  await openFixture(page);
  await expect(page.getByRole("region", { name: "Architecture context", exact: true })).toContainText("Keep customer data in Europe.");
  await page.locator('.react-flow__node[data-id="app"]').getByText("Payments API", { exact: true }).click();
  await expect(page.getByLabel("Declared region", { exact: true })).toHaveValue("westeurope");
  await expect(page.getByRole("region", { name: "Linked requirements" })).toContainText("EU residency");
  await expect(page.getByRole("region", { name: "Recorded evidence" })).toContainText("Owner requests EU residency.");
  await page.getByLabel("Declared region", { exact: true }).fill("northeurope");
  await page.getByLabel("Declared region", { exact: true }).blur();
  await page.getByRole("button", { name: "Undo (Ctrl+Z)", exact: true }).click();
  await expect(page.getByLabel("Declared region", { exact: true })).toHaveValue("westeurope");
  await page.getByRole("button", { name: "Redo (Ctrl+Y)", exact: true }).click();
  await expect(page.getByLabel("Declared region", { exact: true })).toHaveValue("northeurope");
  await page.getByRole("button", { name: "Select connection 1 HTTPS", exact: true }).click();
  await page.getByRole("combobox", { name: "Relationship type", exact: true }).selectOption("dependency");
  const expected = parseArchitectureDocument(fixture);
  expected.nodes[1].semantics!.region = "northeurope";
  expected.edges[0].semantics!.connectionType = "dependency";
  expect(await exported(page)).toEqual(expected);
  await page.getByRole("button", { name: "My diagrams", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Saved diagrams", exact: true });
  await library.getByLabel("Diagram name", { exact: true }).fill("Semantic model acceptance");
  await library.getByRole("button", { name: "Save current diagram", exact: true }).click();
  await expect(library.getByText('Saved "Semantic model acceptance" in this browser.', { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Close diagram library" }).click();
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  expect(await exported(page)).toEqual(expected);
  await expect.poll(async () => await readCanvasPayload(page, "architecture")).toEqual(expected);
});

test("future versions and dangling semantic references fail before replacing a valid canvas", async ({ page }) => {
  await openFixture(page);
  const before = await exported(page);
  const missingEvidence = structuredClone(fixture);
  missingEvidence.nodes[1].semantics!.evidenceIds = ["not-present"];
  for (const invalid of [{ ...fixture, schemaVersion: 999 }, missingEvidence]) {
    await importGraph(page, invalid);
    await expect(page.getByRole("status").filter({ hasText: "Import failed:" })).toBeVisible();
    expect(await exported(page)).toEqual(before);
  }
});

test("review and deployment requests carry the complete context; offline exports disclose unsupported settings", async ({ page }) => {
  const requests: Record<string, { payload: ArchPayload }> = {};
  await page.route("**/api/ai/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (name === "privacy") {
      await route.fulfill({ json: privacyFixture });
    } else if (name === "status") {
      await route.fulfill({ json: { configured: true, diagramConfigured: false, imageConfigured: false, reviewAgentConfigured: true, deploymentAgentConfigured: true } });
    } else {
      requests[name] = route.request().postDataJSON();
      await route.fulfill({ status: 503, json: { error: "Captured by model acceptance fixture; no provider invoked." } });
    }
  });

  await page.route("**/api/deploy/template", (route) => route.fulfill({ status: 400, json: { error: "Publication is not part of this test." } }));
  await openFixture(page);
  const expected = await exported(page);
  await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review my architecture", exact: true });
  await expect(review.getByRole("button", { name: "Run Foundry review", exact: true })).toBeEnabled();
  await review.getByRole("button", { name: "Run Foundry review", exact: true }).click();
  await expect.poll(() => requests.review?.payload).toEqual(expected);
  await review.getByRole("button", { name: "Close architecture review", exact: true }).click();
  await page.getByRole("button", { name: "Deploy architecture to Azure", exact: true }).click();
  const deployment = page.getByRole("dialog", { name: "Deploy architecture to Azure", exact: true });
  await deployment.getByRole("button", { name: "Generate with Foundry agent", exact: true }).click();
  await expect.poll(() => requests.deploy?.payload).toEqual(expected);
  await expect(deployment.getByRole("alert")).toContainText("no provider invoked");
  await deployment.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
  await expect(deployment).toContainText("does not implement those per-service settings");
  await expect(deployment).toContainText("does not evaluate or satisfy");
});

test("legacy future-version storage stays intact and autosave remains paused while editing", async ({ page }) => {
  const raw = JSON.stringify({ version: 99, savedAt: "2026-09-20T00:00:00Z", graph: { nodes: [], edges: [], metadata: { name: "Future document" } } });
  await page.addInitScript((raw) => {
    if (!sessionStorage.getItem("future-seeded")) {
      localStorage.setItem("playground:autosave", raw);
      sessionStorage.setItem("future-seeded", "true");
    }
  }, raw);
  await page.goto("/legacy-playground");
  await expect(page.getByRole("alert").filter({ hasText: "Autosave paused" })).toBeVisible();
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "scratch.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ nodes: [{ id: "scratch", type: "service", position: { x: 100, y: 100 }, data: { iconId: "azure/application/application-service", cloud: "azure", label: "New scratch work" } }], edges: [] })),
  });
  await expect(page.locator(".react-flow__node-service")).toHaveCount(1);
  // Cross the actual one-second legacy autosave debounce to detect an overwrite.
  await page.waitForTimeout(1300);
  expect(await page.evaluate(() => localStorage.getItem("playground:autosave"))).toBe(raw);
});

test("legacy JSON import rejects future envelopes without replacing the current graph", async ({ page }) => {
  await page.goto("/legacy-playground");
  const input = page.locator('input[type="file"][accept*=".json"]');
  const graph = { nodes: [{ id: "keep", type: "service", position: { x: 100, y: 100 }, data: { iconId: "azure/application/application-service", cloud: "azure", label: "Keep this diagram" } }], edges: [] };
  await input.setInputFiles({ name: "current.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ version: 2, graph })) });
  await expect(page.locator('.react-flow__node[data-id="keep"]')).toBeVisible();
  let message = "";
  page.once("dialog", async (dialog) => { message = dialog.message(); await dialog.accept(); });
  await input.setInputFiles({ name: "future.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ version: 99, graph: { nodes: [], edges: [] } })) });
  await expect.poll(() => message).toContain("Unsupported or invalid diagram version");
  await expect(page.locator('.react-flow__node[data-id="keep"]')).toContainText("Keep this diagram");
});
