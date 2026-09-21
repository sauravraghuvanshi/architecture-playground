import { expect, test } from "@playwright/test";
import { parseArchitectureDocument } from "../lib/architecture-document";
import { parseArmTemplate } from "../lib/deployment-assistance";
import { generateArchitectureCode, generateArmTemplate } from "../components/diagrammatic/csa/architecture-codegen";
import { privacyFixture } from "./ai-privacy-fixture";
import { readCanvasPayload } from "./read-canvas-payload";
import { readSavedDiagram } from "./read-saved-diagram";
import { waitForWorkspace } from "./wait-for-workspace";

const screenshotArchitecture = parseArchitectureDocument({
  nodes: [
    { id: "client", kind: "shape", shape: "person", label: "Client", x: 20, y: 200 },
    { id: "apim", kind: "icon", iconId: "azure/application/app-service-api-management", iconPath: "", label: "APP Service API Management", x: 280, y: 20 },
    { id: "app", kind: "icon", iconId: "azure/application/app-service-management", iconPath: "", label: "APP Service", x: 540, y: 200 },
  ],
  edges: [
    { id: "client-api", source: "client", target: "apim", label: "HTTPS", step: 1, style: "flow" },
    { id: "api-app", source: "apim", target: "app", label: "HTTPS", step: 2, style: "flow" },
  ],
});

test("native elbow arrows save, reload, switch to Cloud Architecture and convert without false binding errors", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { diagramConfigured: true, imageConfigured: false } }));
  await page.route("**/api/ai/privacy", (route) => route.fulfill({ json: privacyFixture }));
  let conversionCalls = 0;
  await page.route("**/api/ai/convert", async (route) => {
    conversionCalls++;
    const body = route.request().postDataJSON();
    expect(body.image.dataUrl).toMatch(/^data:image\/png;base64,/);
    await route.fulfill({ json: {
      payload: {
        nodes: [
          { id: "app", kind: "icon", iconId: "azure/application/application-service", iconPath: "", label: "Azure App Service", x: 100, y: 100 },
          { id: "sql", kind: "icon", iconId: "azure/data/sql-database", iconPath: "", label: "Azure SQL Database", x: 350, y: 100 },
        ],
        edges: [{ id: "app-sql", source: "app", target: "sql", label: "HTTPS" }],
      }, warnings: ["Synthetic vision response; no model invoked."],
    } });
  });
  await page.goto("/diagrammatic?mode=whiteboard");
  await waitForWorkspace(page);
  const board = page.locator(".diagrammatic-whiteboard");
  const search = page.getByRole("searchbox", { name: "Search Whiteboard assets" });
  for (const [name, x] of [["User", 350], ["Server", 800]] as const) {
    await search.fill(name.toLowerCase());
    await page.getByRole("button", { name, exact: true }).first().dragTo(board, { targetPosition: { x, y: 400 } });
  }
  await expect.poll(async () => {
    const payload = await readCanvasPayload(page, "whiteboard") as { elements?: unknown[] } | undefined;
    return payload?.elements?.length;
  }).toBe(2);
  await page.getByRole("button", { name: "Activate Whiteboard flow arrow" }).click();
  await page.getByRole("group", { name: "Arrow type", exact: true }).locator('label[title="Elbow arrow"]').click();
  const box = await board.boundingBox();
  if (!box) throw new Error("Native Whiteboard unavailable");
  await page.mouse.move(box.x + 445, box.y + 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 705, box.y + 400, { steps: 16 });
  await page.mouse.up();
  type Scene = { elements: Array<{ type: string; id: string; elbowed?: boolean; startBinding?: { fixedPoint?: number[] }; endBinding?: { fixedPoint?: number[] } }> };
  await expect.poll(async () => {
    const payload = await readCanvasPayload(page, "whiteboard") as Scene | undefined;
    return payload?.elements?.filter((element) => element.type === "arrow").length;
  }).toBe(1);
  const before = await readCanvasPayload(page, "whiteboard") as Scene;
  const arrow = before.elements.find((element) => element.type === "arrow");
  expect(arrow?.elbowed).toBe(true);
  const points = [...arrow?.startBinding?.fixedPoint ?? [], ...arrow?.endBinding?.fixedPoint ?? []];
  expect(points.some((value) => value < 0 || value > 1)).toBe(true);
  await expect(page.getByText(/Invalid Whiteboard scene|autosave failed|Could not preserve/)).toHaveCount(0);
  await page.getByRole("tab", { name: "Cloud Architecture", exact: true }).click();
  await waitForWorkspace(page);
  await expect(page.getByRole("tab", { name: "Cloud Architecture", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Whiteboard", exact: true }).click();
  await waitForWorkspace(page);
  await page.reload();
  await waitForWorkspace(page);
  const restored = await readCanvasPayload(page, "whiteboard") as Scene;
  const restoredArrow = restored.elements.find((element) => element.id === arrow?.id);
  expect(restoredArrow?.startBinding).toEqual(arrow?.startBinding);
  expect(restoredArrow?.endBinding).toEqual(arrow?.endBinding);
  await page.getByRole("button", { name: "Convert Whiteboard to architecture", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Convert Whiteboard to architecture", exact: true });
  await dialog.getByRole("button", { name: "Analyze Whiteboard", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Conversion preview" })).toContainText("Azure App Service");
  expect(conversionCalls).toBe(1);
  await dialog.getByRole("checkbox", { name: /I reviewed this preview/ }).check();
  await dialog.getByRole("button", { name: "Create architecture document", exact: true }).click();
  await expect(page.locator(".react-flow__node-icon")).toHaveCount(2);
  const saved = await readSavedDiagram(page, "Untitled Whiteboard");
  expect((saved?.payload as Scene).elements.find((element) => element.id === arrow?.id)?.startBinding).toEqual(arrow?.startBinding);
});

test("screenshot service symbols have explicit repair, real offline output and a validated AI request path", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: {
    diagramConfigured: true, imageConfigured: true, deploymentAgentConfigured: true, reviewAgentConfigured: true,
  } }));
  await page.route("**/api/ai/privacy", (route) => route.fulfill({ json: privacyFixture }));
  let requests = 0;
  await page.route("**/api/ai/deploy", async (route) => {
    requests++;
    const input = route.request().postDataJSON();
    const payload = parseArchitectureDocument(input.payload);
    expect(payload.nodes.find((node) => node.id === "app")).toMatchObject({ iconId: "azure/application/application-service", label: "APP Service" });
    expect(payload.edges).toEqual(screenshotArchitecture.edges);
    const arm = parseArmTemplate(generateArmTemplate(payload).template);
    const response = {
      format: "bicep", code: generateArchitectureCode(payload, "bicep").output, armTemplate: arm,
      assumptions: ["Synthetic browser fixture; no Foundry call."], warnings: [],
      resourceMappings: arm.resources.map((resource) => ({
        nodeId: resource.type.startsWith("Microsoft.ApiManagement") ? "apim" : "app",
        resourceType: resource.type, resourceName: resource.name,
      })),
      validation: {
        version: 1, profile: "azure-static-v1", artifactHash: "a".repeat(64), checkedAt: "2026-09-21T18:00:00.000Z",
        status: "passed-static-checks", canPublish: true, coverage: [],
        parser: { name: "fixture", version: "1" }, disclaimer: "Synthetic response; no model or customer deployment.",
        checks: ["syntax", "resource-mappings", "coverage", "prerequisites", "artifact-consistency", "azure-environment"].map((id) => ({
          id, status: id === "azure-environment" ? "not-verified" : "passed",
          summary: "Fixture schema; real validators are tested separately.", details: [],
        })),
      },
    };
    await route.fulfill({ json: response });
  });
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "user-screenshot-architecture.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(screenshotArchitecture)),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.getByRole("button", { name: "Deploy architecture to Azure", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Deploy architecture to Azure", exact: true });
  await expect(dialog.getByRole("region", { name: "Deployment service readiness" })).toContainText("1 of 2");
  await dialog.getByRole("button", { name: "Use Azure App Service for APP Service", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Deploy architecture to Azure", exact: true });
  await expect(dialog.getByRole("region", { name: "Deployment service readiness" })).toContainText("2 of 2");
  await dialog.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
  const preview = dialog.getByRole("region", { name: "Deployment preview" });
  await expect(preview).toContainText("Microsoft.ApiManagement/service");
  await expect(preview).toContainText("Microsoft.Web/sites");
  await dialog.getByRole("button", { name: "Generate with Foundry agent", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Deployment preview" })).toContainText("Runtime Foundry agent draft");
  expect(requests).toBe(1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo (Ctrl+Z)", exact: true }).click();
  await expect.poll(async () => {
    const payload = await readCanvasPayload(page, "architecture") as typeof screenshotArchitecture;
    const node = payload?.nodes.find((node) => node.id === "app");
    return node && "iconId" in node ? node.iconId : undefined;
  }).toBe("azure/application/app-service-management");
  await page.getByRole("button", { name: "Redo (Ctrl+Y)", exact: true }).click();
  await page.getByRole("tab", { name: "Whiteboard", exact: true }).click();
  await waitForWorkspace(page);
  await page.getByRole("tab", { name: "Cloud Architecture", exact: true }).click();
  await waitForWorkspace(page);
  await page.reload();
  await waitForWorkspace(page);
  const restored = await readCanvasPayload(page, "architecture") as typeof screenshotArchitecture;
  expect(restored.nodes.find((node) => node.id === "app")).toMatchObject({ iconId: "azure/application/application-service", label: "APP Service", x: 540, y: 200 });
  expect(restored.edges).toEqual(screenshotArchitecture.edges);
});
