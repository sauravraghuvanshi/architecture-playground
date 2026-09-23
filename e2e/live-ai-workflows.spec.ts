import { expect, test } from "@playwright/test";
import { readSavedDiagram } from "./read-saved-diagram";
import { readCanvasPayload } from "./read-canvas-payload";
import { waitForWorkspace } from "./wait-for-workspace";
import { parseArchitectureDocument } from "../lib/architecture-document";
import { writeFile } from "node:fs/promises";

test.skip(
  process.env.LIVE_INVOKE_AI !== "true" || !process.env.PLAYWRIGHT_STORAGE_STATE,
  "Requires explicit paid-inference opt-in and an authenticated browser storage state.",
);

test("real guided design applies to a named document and receives a personalized Foundry review", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/diagrammatic");
  await waitForWorkspace(page);
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "AI Assist", exact: true });
  await modal.getByLabel("Describe what to build").fill("Create exactly two Azure services: Azure App Service named Web API calls Azure SQL Database named Orders DB over one SQL connection. Do not add other services. Synthetic demo only.");
  await modal.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(modal.getByRole("region", { name: "Guided design preview" })).toBeVisible({ timeout: 130_000 });
  await modal.getByRole("button", { name: "Apply generated design", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect.poll(async () => (await readSavedDiagram(page, "AI design proposal"))?.mode).toBe("architecture");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  const saved = await readSavedDiagram(page, "AI design proposal");
  if (!saved) throw new Error("Generated design was not saved");
  const graph = parseArchitectureDocument(saved.payload);
  const app = graph.nodes.find((node) => node.kind === "icon" && node.iconId === "azure/application/application-service");
  const sql = graph.nodes.find((node) => node.kind === "icon" && node.iconId === "azure/data/sql-database");
  expect(app).toBeDefined();
  expect(sql).toBeDefined();
  expect(graph.nodes).toHaveLength(2);
  expect(graph.edges).toHaveLength(1);
  expect(graph.edges[0]).toMatchObject({ source: app?.id, target: sql?.id });
  await writeFile(test.info().outputPath("live-generated-architecture.json"), JSON.stringify(graph, null, 2));

  await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review my architecture", exact: true });
  await review.getByPlaceholder(/Add business criticality/).fill("Synthetic prototype. Four-hour recovery target. Deployment settings are unverified.");
  await review.getByRole("button", { name: "Run Foundry review", exact: true }).click();
  await expect(review.getByRole("region", { name: "Your personalized review" })).toBeVisible({ timeout: 130_000 });
  await expect(review.getByRole("region", { name: "Your personalized review" }).getByRole("article").first()).toBeVisible();
  await expect(review.getByRole("region", { name: "Review provenance" })).toContainText("Runtime verified: no");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    review.getByRole("button", { name: "Download review JSON" }).click(),
  ]);
  await download.saveAs(test.info().outputPath("live-architecture-review.json"));
});

test("real Whiteboard image generation inserts decoded image data into the browser draft", async ({ page }) => {
  test.setTimeout(330_000);
  await page.goto("/diagrammatic?mode=whiteboard");
  await waitForWorkspace(page);
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "AI Assist", exact: true });
  await modal.getByLabel("Describe the image to generate").fill("Two simple labeled boxes, Web app and Database, with one arrow. Match the current canvas background and foreground. Minimal line diagram, no people or logos.");
  await modal.getByLabel("Visual style", { exact: true }).selectOption("executive");
  await modal.getByRole("button", { name: "Generate image", exact: true }).click();
  await expect(modal).toHaveCount(0, { timeout: 285_000 });
  type Scene = { elements: Array<{ type: string; fileId?: string }>; files: Record<string, { dataURL: string; mimeType: string }> };
  await expect.poll(async () => {
    const payload = await readCanvasPayload(page, "whiteboard") as Scene | undefined;
    return payload?.elements?.some((element) => element.type === "image" && element.fileId && payload.files?.[element.fileId]?.dataURL?.startsWith("data:image/"));
  }, { timeout: 15_000 }).toBe(true);
  const payload = await readCanvasPayload(page, "whiteboard") as Scene;
  const image = payload.elements.find((element) => element.type === "image" && element.fileId);
  if (!image?.fileId) throw new Error("Generated image has no saved binary");
  const file = payload.files[image.fileId];
  const extension = file.mimeType === "image/jpeg" ? "jpg" : file.mimeType.split("/")[1];
  await writeFile(test.info().outputPath(`live-whiteboard-image.${extension}`), Buffer.from(file.dataURL.split(",")[1], "base64"));
  await writeFile(test.info().outputPath("live-whiteboard-scene.json"), JSON.stringify(payload));
});

test("real Foundry deployment draft reaches code and ARM previews without automatic publication", async ({ page }) => {
  test.setTimeout(180_000);
  const publications: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/deploy/template") publications.push(request.url());
  });
  await page.goto("/diagrammatic");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import architecture JSON", exact: true }).click();
  await (await chooser).setFiles({
    name: "synthetic-deployment.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      nodes: [{ id: "app", kind: "icon", label: "Synthetic web app", iconId: "azure/application/application-service",
        iconPath: "/cloud-icons/azure/application/application-service.svg", x: 0, y: 0 }],
      edges: [],
    })),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(1, { timeout: 15_000 });
  await page.getByRole("button", { name: "Deploy architecture to Azure", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Deploy architecture to Azure", exact: true });
  await modal.getByLabel("Deployment constraints", { exact: true }).fill("Synthetic demonstration only; generate but do not deploy. One App Service and its required B1 plan, location parameter default westeurope. Use literal demonstration resource names demo-site-2026 and demo-plan-2026; actual deployment would require availability checks. HTTPS only and system-assigned identity. Code and ARM must match.");
  const result = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/ai/deploy" && response.request().method() === "POST");
  await modal.getByRole("button", { name: "Generate with Foundry agent", exact: true }).click();
  const response = await result;
  const draft = await response.json();
  await writeFile(test.info().outputPath("live-deployment-draft.json"), JSON.stringify(draft, null, 2));
  expect(response.status()).toBe(200);
  await expect(modal.getByText("Runtime Foundry agent draft", { exact: true })).toBeVisible({ timeout: 130_000 });
  await expect(modal.getByTestId("generated-code")).toContainText("Microsoft.Web");
  await modal.getByRole("button", { name: "ARM template for Portal", exact: true }).click();
  await expect(modal.getByTestId("generated-arm-template")).toContainText("Microsoft.Web/sites");
  await expect(modal.getByRole("button", { name: "Open Azure Review + Create", exact: true })).toBeDisabled();
  expect(publications).toEqual([]);
});
