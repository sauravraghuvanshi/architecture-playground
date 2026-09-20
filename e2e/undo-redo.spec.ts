import { expect, test, type Page } from "@playwright/test";
import { readCanvasPayload } from "./read-canvas-payload";
import { waitForWorkspace } from "./wait-for-workspace";

test.describe.configure({ timeout: 90_000 });

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgqLjyHwAEFAJMURtfXQAAAABJRU5ErkJggg==";
const architecture = {
  nodes: [
    { id: "boundary", kind: "group", label: "Compute", tier: "Compute", x: 0, y: 0, width: 440, height: 220 },
    { id: "api", kind: "shape", shape: "rectangle", label: "API", x: 30, y: 60, parentId: "boundary" },
    { id: "db", kind: "shape", shape: "database", label: "Database", x: 600, y: 60 },
  ],
  edges: [{ id: "request", source: "api", target: "db", label: "HTTPS", style: "flow", step: 1 }],
};

async function draft(page: Page, mode: "architecture" | "whiteboard") {
  return await readCanvasPayload(page, mode) as {
      nodes?: Array<{ id: string; width?: number; height?: number; x: number; y: number }>;
      edges?: Array<{ id: string; style: string; label: string; step: number }>;
      elements?: Array<{ id: string; fileId?: string; isDeleted?: boolean }>;
      files?: Record<string, { dataURL: string }>;
    } | undefined;
}

async function undo(page: Page) {
  await page.getByRole("button", { name: "Undo (Ctrl+Z)", exact: true }).click();
}
async function redo(page: Page) {
  await page.getByRole("button", { name: "Redo (Ctrl+Y)", exact: true }).click();
}
async function openArchitecture(page: Page) {
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "history.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(architecture)),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect.poll(async () => (await draft(page, "architecture"))?.nodes?.length).toBe(3);
}
async function openWhiteboard(page: Page) {
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
}
async function insertSymbol(page: Page, name: string) {
  await page.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill(name);
  await page.getByRole("button", { name, exact: true }).first().click();
}
async function imageCount(page: Page) {
  return (await draft(page, "whiteboard"))?.elements?.filter((element) => !element.isDeleted).length ?? 0;
}

test("Whiteboard click and AI image inserts undo individually and redo with identical binaries", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { diagramConfigured: false, imageConfigured: true, imageSource: "local" } }));
  await page.route("**/api/ai/image", (route) => route.fulfill({
    contentType: "text/event-stream",
    body: `data: ${JSON.stringify({ type: "result", b64: png, size: "1024x1024", elapsed: 1 })}\n\n`,
  }));
  await openWhiteboard(page);
  await insertSymbol(page, "User");
  await expect.poll(() => imageCount(page)).toBe(1);
  await insertSymbol(page, "Database");
  await expect.poll(() => imageCount(page)).toBe(2);
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  await page.getByLabel("Describe the image to generate").fill("Synthetic history test image");
  await page.getByRole("button", { name: "Generate image", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "AI Assist", exact: true })).toHaveCount(0);
  await expect.poll(() => imageCount(page)).toBe(3);
  const original = await draft(page, "whiteboard");
  for (const count of [2, 1, 0]) {
    await undo(page);
    await expect.poll(() => imageCount(page)).toBe(count);
  }
  for (const count of [1, 2, 3]) {
    await redo(page);
    await expect.poll(() => imageCount(page)).toBe(count);
  }
  const restored = await draft(page, "whiteboard");
  expect(restored?.elements?.map((element) => element.id)).toEqual(original?.elements?.map((element) => element.id));
  for (const element of restored?.elements ?? []) {
    expect(element.fileId).toBeTruthy();
    expect(restored?.files?.[element.fileId!]?.dataURL).toBe(original?.files?.[element.fileId!]?.dataURL);
  }
});

test("Whiteboard drag insertion is undoable and a new insert invalidates the old redo branch", async ({ page }) => {
  await openWhiteboard(page);
  await page.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill("User");
  await page.getByRole("button", { name: "User", exact: true }).first().dragTo(page.locator(".diagrammatic-whiteboard"));
  await expect.poll(() => imageCount(page)).toBe(1);
  const oldId = (await draft(page, "whiteboard"))?.elements?.[0].id;
  await undo(page);
  await expect.poll(() => imageCount(page)).toBe(0);
  await redo(page);
  await expect.poll(() => imageCount(page)).toBe(1);
  await undo(page);
  await expect.poll(() => imageCount(page)).toBe(0);
  await insertSymbol(page, "Database");
  await expect.poll(() => imageCount(page)).toBe(1);
  const newId = (await draft(page, "whiteboard"))?.elements?.[0].id;
  expect(newId).not.toBe(oldId);
  await redo(page);
  expect((await draft(page, "whiteboard"))?.elements?.map((element) => element.id)).toEqual([newId]);
});

test("Whiteboard native keyboard shortcuts share insertion history with the workspace toolbar", async ({ page }) => {
  await openWhiteboard(page);
  await insertSymbol(page, "User");
  await expect.poll(() => imageCount(page)).toBe(1);
  const original = (await draft(page, "whiteboard"))?.elements?.[0].id;
  await page.locator(".diagrammatic-whiteboard").click({ position: { x: 35, y: 250 } });
  await page.keyboard.press("Control+z");
  await expect.poll(() => imageCount(page)).toBe(0);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => imageCount(page)).toBe(1);
  expect((await draft(page, "whiteboard"))?.elements?.[0].id).toBe(original);
  await undo(page);
  await expect.poll(() => imageCount(page)).toBe(0);
});

test("architecture resize is a single reversible gesture and preserves its children", async ({ page }) => {
  await openArchitecture(page);
  const group = page.locator('.react-flow__node[data-id="boundary"]');
  await group.click({ position: { x: 20, y: 15 } });
  const handle = group.locator(".react-flow__resize-control.handle.bottom.right");
  await expect(handle).toBeVisible();
  await handle.hover();
  const box = await handle.boundingBox();
  if (!box) throw new Error("Resize control is unavailable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 65, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await draft(page, "architecture"))?.nodes?.[0].width).toBeGreaterThan(440);
  const resized = (await draft(page, "architecture"))?.nodes?.[0];
  await undo(page);
  await expect.poll(async () => (await draft(page, "architecture"))?.nodes?.[0].width).toBe(440);
  await expect(group).toHaveCSS("width", "440px");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await redo(page);
  await expect.poll(async () => (await draft(page, "architecture"))?.nodes?.[0].width).toBe(resized?.width);
  await expect.poll(async () => (await draft(page, "architecture"))?.nodes?.[0].height).toBe(resized?.height);
  await undo(page);
  await expect.poll(async () => (await draft(page, "architecture"))?.nodes?.[0].width).toBe(440);
  await undo(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});

test("architecture bulk styles restore graph and toolbar state and replace the redo branch", async ({ page }) => {
  await openArchitecture(page);
  await page.getByRole("button", { name: "flow", exact: true }).click();
  await expect.poll(async () => (await draft(page, "architecture"))?.edges?.[0].style).toBe("solid");
  await page.getByRole("button", { name: "solid", exact: true }).click();
  await expect.poll(async () => (await draft(page, "architecture"))?.edges?.[0].style).toBe("dashed");
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "solid", exact: true })).toBeVisible();
  await expect.poll(async () => (await draft(page, "architecture"))?.edges?.[0].style).toBe("solid");
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByRole("button", { name: "dashed", exact: true })).toBeVisible();
  await undo(page);
  await expect.poll(async () => (await draft(page, "architecture"))?.edges?.[0].style).toBe("solid");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await redo(page);
  await expect(page.getByRole("button", { name: "solid", exact: true })).toBeVisible();
  expect((await draft(page, "architecture"))?.edges?.[0]).toMatchObject({ style: "solid", label: "HTTPS", step: 1 });
});

test("architecture keyboard deletion restores connected elements with one undo checkpoint", async ({ page }) => {
  await openArchitecture(page);
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await page.locator('.react-flow__node[data-id="api"]').click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await undo(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await undo(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await redo(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
});
