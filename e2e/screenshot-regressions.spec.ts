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

for (const source of ["draft", "named"] as const) {
  test(`saved ${source} Whiteboard opens around unfinished remnants with no canvas recovery banner`, async ({ page }) => {
    const payload = {
      elements: [
        { id: "retained-service", type: "rectangle", x: 100, y: 100, width: 200, height: 120 },
        { id: "dot", type: "freedraw", x: 400, y: 100, width: 0, height: 0, points: [[0, 0], [0, 0]] },
        { id: "unfinished-rectangle", type: "rectangle", x: 600, y: 200, width: 0, height: 0 },
        { id: "pending-image", type: "image", x: 700, y: 200, width: 100, height: 100, fileId: null, status: "pending", scale: [1, 1] },
      ],
      appState: { viewBackgroundColor: "#f8fafc" }, files: {},
    };
    const name = source === "named" ? "Screenshot original" : "Whiteboard (recovered draft)";
    await page.route("**/api/ai/status", (route) => route.fulfill({ json: { diagramConfigured: false, imageConfigured: false } }));
    await page.goto("/about");
    await page.evaluate(async ({ source, payload, name }) => {
      if (source === "draft") {
        localStorage.setItem("diagrammatic.draft.whiteboard", JSON.stringify({ payload, savedAt: 1 }));
        return;
      }
      const record = {
        schemaVersion: 1, id: "screenshot-original", name, mode: "whiteboard", payload, canvasTheme: "light",
        comments: [], versions: [], revision: 1, createdAt: 1, updatedAt: 1,
      };
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("diagrammatic.library", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("documents", { keyPath: "id" });
          request.result.createObjectStore("summaries", { keyPath: "id" });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(["documents", "summaries"], "readwrite");
          transaction.objectStore("documents").put(record);
          transaction.objectStore("summaries").put({
            schemaVersion: 1, id: record.id, name, mode: record.mode, canvasTheme: "light",
            revision: 1, createdAt: 1, updatedAt: 1, commentCount: 0, versionCount: 0,
          });
          transaction.oncomplete = () => { db.close(); resolve(); };
          transaction.onerror = () => { db.close(); reject(transaction.error); };
        };
      });
      localStorage.setItem("diagrammatic.active-documents", JSON.stringify({ whiteboard: record.id }));
    }, { source, payload, name });
    await page.goto(`/diagrammatic?mode=whiteboard${source === "named" ? "&document=screenshot-original" : ""}`);
    await waitForWorkspace(page);
    const messages = page.getByText(/Some saved data needs recovery|could not be recovered|unfinished drawing|autosave failed/i);
    await expect(messages).toHaveCount(0);
    await page.keyboard.press("Control+s");
    await expect.poll(async () => (await readSavedDiagram(page, name))?.versions.length).toBe(1);
    const saved = await readSavedDiagram(page, name);
    expect(saved?.versions[0].payload).toEqual(payload);
    const scene = saved?.payload as { elements: Array<{ id: string; width: number; height: number }> };
    expect(scene.elements.map(({ id }) => id)).toEqual(["retained-service", "dot"]);
    expect(scene.elements[0]).toMatchObject({ width: 200, height: 120 });
    await page.getByRole("tab", { name: "Cloud Architecture", exact: true }).click();
    await waitForWorkspace(page);
    await expect(messages).toHaveCount(0);
    await page.getByRole("tab", { name: "Whiteboard", exact: true }).click();
    await waitForWorkspace(page);
    await page.reload();
    await waitForWorkspace(page);
    await expect(messages).toHaveCount(0);
    const restored = await readSavedDiagram(page, name);
    expect(restored?.versions).toEqual(saved?.versions);
    expect((restored?.payload as typeof scene).elements[0]).toMatchObject({ id: "retained-service", width: 200, height: 120 });
    if (source === "draft") {
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("diagrammatic.draft.whiteboard")!).payload)).toEqual(payload);
    }
  });
}

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

test("autosave waits through a long native Whiteboard gesture without a recovery banner or lost geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { diagramConfigured: false, imageConfigured: false } }));
  await page.goto("/diagrammatic?mode=whiteboard");
  await waitForWorkspace(page);
  await page.getByRole("tab", { name: "Cloud Architecture", exact: true }).click();
  await waitForWorkspace(page);
  await page.getByRole("tab", { name: "Whiteboard", exact: true }).click();
  await waitForWorkspace(page);
  const board = page.locator(".diagrammatic-whiteboard");
  const box = await board.boundingBox();
  if (!box) throw new Error("Native Whiteboard unavailable");
  const drawing = async (x: number) => {
    await board.click({ position: { x: 550, y: 600 } });
    await page.keyboard.press("r");
    await page.mouse.move(box.x + x, box.y + 300);
    await page.mouse.down();
    // Excalidraw's frame throttle takes the first move in a frame, not the last.
    for (let step = 1; step <= 8; step++) {
      await page.mouse.move(box.x + x + step * 12.5, box.y + 300 + step * 12.5);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    }
  };
  await drawing(300);
  await page.mouse.up();
  // Publish the completed edit, but start the next before its 650ms autosave.
  await page.waitForTimeout(120);
  await drawing(600);
  await page.waitForTimeout(1600);
  const errors = page.getByText(/autosave failed|Finish or cancel|Canvas editing has not settled|Could not preserve|Save recovery copy/i);
  await expect(errors).toHaveCount(0);
  await page.mouse.up();
  type Scene = { elements: Array<{ id: string; type: string; x: number; y: number; width: number; height: number }> };
  await expect.poll(async () => ((await readCanvasPayload(page, "whiteboard")) as Scene)?.elements.length).toBe(2);
  const saved = (await readCanvasPayload(page, "whiteboard")) as Scene;
  expect(saved.elements.map(({ width, height }) => ({ width, height }))).toEqual([
    { width: 100, height: 100 }, { width: 100, height: 100 },
  ]);
  await page.getByRole("tab", { name: "Cloud Architecture", exact: true }).click();
  await waitForWorkspace(page);
  await page.getByRole("tab", { name: "Whiteboard", exact: true }).click();
  await waitForWorkspace(page);
  await page.reload();
  await waitForWorkspace(page);
  const restored = (await readCanvasPayload(page, "whiteboard")) as Scene;
  const geometry = (scene: Scene) => scene.elements.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));
  expect(geometry(restored)).toEqual(geometry(saved));
  await expect(errors).toHaveCount(0);
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
