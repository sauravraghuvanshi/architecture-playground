import { expect, test, type Page } from "@playwright/test";
import { readSavedDiagram } from "./read-saved-diagram";
import { readCanvasPayload } from "./read-canvas-payload";
import { waitForWorkspace } from "./wait-for-workspace";
import { parseArchitectureDocument } from "../lib/architecture-document";

const original = {
  nodes: [{ kind: "shape", id: "existing", label: "Existing architecture", shape: "rectangle", x: 0, y: 0 }],
  edges: [],
};
const converted = {
  nodes: [
    { kind: "group", id: "workload", label: "Workload boundary", x: 0, y: 0, width: 600, height: 300 },
    { kind: "shape", id: "api", label: "Visible API", shape: "rectangle", x: 30, y: 80, width: 128, height: 104, parentId: "workload" },
    { kind: "shape", id: "db", label: "Custom store", shape: "database", x: 300, y: 80, width: 128, height: 104, parentId: "workload" },
  ],
  edges: [{ id: "e", source: "api", target: "db", label: "TLS", style: "dashed", step: 2 }],
};

async function openConversion(page: Page) {
  await page.goto("/diagrammatic?mode=whiteboard");
  const canvas = page.locator(".excalidraw");
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Whiteboard is unavailable");
  await page.locator("label").filter({ has: page.getByRole("radio", { name: "Rectangle", exact: true }) }).click();
  await page.mouse.move(box.x + 250, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 330, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("diagrammatic.draft.whiteboard") ?? "{}");
    return draft.payload?.elements?.some((element: { type: string }) => element.type === "rectangle");
  })).toBe(true);
  await page.getByRole("button", { name: "Convert Whiteboard to architecture", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Convert Whiteboard to architecture", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((payload) => {
    if (sessionStorage.getItem("conversion-test-initialized")) return;
    sessionStorage.setItem("conversion-test-initialized", "true");
    localStorage.clear();
    localStorage.setItem("diagrammatic.draft", JSON.stringify({ mode: "architecture", payload }));
  }, original);
  await page.route("**/api/ai/status", (route) => route.fulfill({
    json: { diagramConfigured: true, imageConfigured: true, imageSource: "local" },
  }));
});

test("native PNG conversion previews evidence and requires replacement consent without persisting image", async ({ page }) => {
  test.setTimeout(60_000);
  let submitted: { image: { name: string; mimeType: string; dataUrl: string } } | undefined;
  await page.route("**/api/ai/convert", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { payload: converted, warnings: ["Verify handwritten TLS label."] } });
  });
  await openConversion(page);
  await expect(page.getByRole("note", { name: "Existing architecture warning" })).toContainText("not merge");
  const readArchitecture = () => readCanvasPayload(page, "architecture");
  expect(await readArchitecture()).toEqual(parseArchitectureDocument(original));
  await page.getByRole("button", { name: "Analyze Whiteboard", exact: true }).click();
  const preview = page.getByRole("region", { name: "Conversion preview" });
  await expect(preview).toBeVisible();
  expect(submitted?.image.mimeType).toBe("image/png");
  expect(submitted?.image.dataUrl).toMatch(/^data:image\/png;base64,iVBOR/);
  await expect(preview).toContainText("3 nodes");
  await expect(preview).toContainText("TLS");
  await expect(preview).toContainText("step 2");
  await expect(preview).toContainText("Verify handwritten TLS label.");
  const apply = page.getByRole("button", { name: "Replace architecture", exact: true });
  await expect(apply).toBeDisabled();
  expect(await readArchitecture()).toEqual(parseArchitectureDocument(original));
  await page.getByRole("checkbox", { name: /I reviewed this preview/ }).check();
  await apply.click();
  await expect(page.getByRole("dialog", { name: "Convert Whiteboard to architecture", exact: true })).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator(".react-flow__node")).toHaveCount(3, { timeout: 15_000 });
  expect(await readArchitecture()).toEqual(parseArchitectureDocument(converted));
  const storage = await page.evaluate(() => ({ all: JSON.stringify(localStorage), whiteboard: localStorage.getItem("diagrammatic.draft.whiteboard") }));
  expect(storage.whiteboard).toContain('"rectangle"');
  expect(storage.all).not.toContain("data:image/png");
  expect(storage.all).not.toContain("iVBOR");
});

test("official Azure conversion identities render and survive library reload without label-based substitution", async ({ page }) => {
  test.setTimeout(120_000);
  const payload = {
    nodes: [
      { kind: "icon", id: "app", label: "Checkout API", iconId: "azure/application/application-service", iconPath: "/cloud-icons/azure/application/application-service.svg", x: 20, y: 50 },
      { kind: "icon", id: "sql", label: "Azure SQL Database", iconId: "azure/data/sql-database", iconPath: "/cloud-icons/azure/data/sql-database.svg", x: 300, y: 50 },
      { kind: "shape", id: "unknown", label: "Azure custom service", shape: "rectangle", x: 580, y: 50 },
    ],
    edges: [{ id: "sql-connection", source: "app", target: "sql", label: "SQL", style: "solid" }],
  };
  const normalizedPayload = parseArchitectureDocument({
    nodes: payload.nodes.map((node) => node.kind === "shape" ? { ...node, width: 128, height: 104 } : node),
    edges: payload.edges.map((edge) => ({ ...edge, step: 1 })),
  });
  const readPersistedPayload = async () => {
    const saved = (await readSavedDiagram(page, "Converted Whiteboard"))?.payload;
    // IndexedDB retains undefined fields; exported JSON omits them. Compare the
    // complete document after native defaults and autosave, not the premount fixture.
    return saved === undefined ? undefined : JSON.parse(JSON.stringify(saved));
  };
  await page.route("**/api/ai/convert", (route) => route.fulfill({
    json: {
      payload: {
        ...payload,
        nodes: payload.nodes.map((node) => node.id === "app" ? { ...node, iconPath: payload.nodes[1].iconPath } : node),
      },
      warnings: ["Azure custom service has no catalog match; retained as a generic shape."],
    },
  }));
  await openConversion(page);
  await page.getByRole("button", { name: "Analyze Whiteboard", exact: true }).click();
  await expect(page.getByRole("region", { name: "Conversion preview" })).toContainText("2 service icons");
  await page.getByRole("checkbox", { name: /I reviewed this preview/ }).check();
  await page.getByRole("button", { name: "Replace architecture", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3, { timeout: 30_000 });
  for (const path of [payload.nodes[0].iconPath, payload.nodes[1].iconPath]) {
    const image = page.locator(`.react-flow__node img[src="${path}"]`);
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);
  }
  await expect.poll(readPersistedPayload, { timeout: 15_000 }).toEqual(normalizedPayload);
  await page.goto("/diagrammatic?mode=architecture");
  await page.bringToFront();
  await waitForWorkspace(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.locator('.react-flow__node[data-id="app"]')).toContainText("Checkout API");
  await expect(page.locator(`.react-flow__node[data-id="app"] img[src="${payload.nodes[0].iconPath}"]`)).toBeVisible();
  await expect.poll(readPersistedPayload, { timeout: 15_000 }).toEqual(normalizedPayload);
});

test("cancellation ignores late results and reopening resets confirmation", async ({ page }) => {
  let finish: (() => void) | undefined;
  let requests = 0;
  await page.route("**/api/ai/convert", async (route) => {
    requests++;
    if (requests === 1) await new Promise<void>((resolve) => { finish = resolve; });
    await route.fulfill({ json: { payload: converted, warnings: [] } });
  });
  await openConversion(page);
  await page.getByRole("button", { name: "Analyze Whiteboard", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  finish?.();
  await page.getByRole("button", { name: "Convert Whiteboard to architecture", exact: true }).click();
  await expect(page.getByRole("region", { name: "Conversion preview" })).toHaveCount(0);
  await page.getByRole("button", { name: "Analyze Whiteboard", exact: true }).click();
  await expect(page.getByRole("region", { name: "Conversion preview" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /I reviewed this preview/ })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Replace architecture", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  expect(await readCanvasPayload(page, "architecture")).toEqual(parseArchitectureDocument(original));
});

test("invalid model responses and rate limits leave the architecture untouched", async ({ page }) => {
  let attempt = 0;
  await page.route("**/api/ai/convert", async (route) => {
    attempt++;
    await route.fulfill(attempt === 1
      ? { json: { payload: { nodes: converted.nodes, edges: [{ id: "bad", source: "missing", target: "db" }] }, warnings: [] } }
      : { status: 429, json: { error: "Rate limit exceeded" } });
  });
  await openConversion(page);
  await page.getByRole("button", { name: "Analyze Whiteboard", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Conversion preview" })).toHaveCount(0);
  await page.getByRole("button", { name: "Analyze Whiteboard", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Rate limit exceeded");
  expect(await readCanvasPayload(page, "architecture")).toEqual(parseArchitectureDocument(original));
});

test("conversion API rejects spoofed and oversized images before contacting a model", async ({ request }) => {
  const spoofed = await request.post("/api/ai/convert", { data: {
    image: { name: "whiteboard.png", mimeType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=" },
  } });
  expect(spoofed.status()).toBe(400);
  expect(spoofed.headers()["cache-control"]).toBe("no-store");
  const oversized = await request.post("/api/ai/convert", { data: { image: "x".repeat(7_100_001) } });
  expect(oversized.status()).toBe(413);
});
