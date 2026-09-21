import { expect, test } from "@playwright/test";
import { readCanvasPayload } from "./read-canvas-payload";
import { readSavedDiagram } from "./read-saved-diagram";
import { assertCanvasErrors } from "./assert-canvas-errors";
import { waitForWorkspace } from "./wait-for-workspace";

const rectangle = { id: "retained", type: "rectangle", x: 50, y: 60, width: 200, height: 120 };

function normalizedBindings(elements: unknown[]) {
  return elements.map((element) => {
    if (!element || typeof element !== "object") throw new Error("Expected a restored scene element");
    // Excalidraw may settle its empty binding list after initial image hydration.
    return "boundElements" in element && element.boundElements === null ? { ...element, boundElements: [] } : element;
  });
}

for (const [name, payload] of Object.entries({
  "null element": { elements: [null] },
  "invalid geometry": { elements: [{ ...rectangle, x: "outside" }] },
  "missing binary": { elements: [{ ...rectangle, type: "image", fileId: "missing", status: "saved", scale: [1, 1] }], files: {} },
  "dangling binding": { elements: [{ ...rectangle, type: "arrow", points: [[0, 0], [200, 120]], startBinding: { elementId: "missing", focus: 0, gap: 0 } }] },
  "invalid viewport": { elements: [], appState: { zoom: { value: 0 } } },
})) {
  test(`rejects ${name} before engine mount and preserves original recovery bytes`, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    const raw = JSON.stringify({ mode: "whiteboard", payload, savedAt: 1 });
    await page.addInitScript((raw) => {
      if (sessionStorage.getItem("restoration-seeded")) return;
      sessionStorage.setItem("restoration-seeded", "yes");
      localStorage.setItem("diagrammatic.draft.whiteboard", raw);
    }, raw);
    await page.goto("/diagrammatic?mode=whiteboard");
    await expect(page.getByRole("alert").filter({ hasText: /Whiteboard could not be recovered/ })).toBeVisible();
    await expect(page.locator(".excalidraw").first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("diagrammatic.draft.whiteboard"))).toBe(raw);
    await page.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill("user");
    await page.getByRole("button", { name: "User", exact: true }).first().click();
    await page.getByRole("button", { name: "Save recovery copy", exact: true }).click();
    await expect.poll(async () => (await readSavedDiagram(page, "Whiteboard (recovery copy)"))?.mode).toBe("whiteboard");
    expect(await page.evaluate(() => localStorage.getItem("diagrammatic.draft.whiteboard"))).toBe(raw);
    await assertCanvasErrors(page, failures);
  });
}

test("rejects malformed version restoration without changing the live Whiteboard or its binaries", async ({ page }) => {
  await page.goto("/diagrammatic?mode=whiteboard");
  await waitForWorkspace(page);
  await expect(page.locator(".excalidraw").first()).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill("user");
  await page.getByRole("button", { name: "User", exact: true }).first().click();
  await expect.poll(async () => {
    const payload = await readCanvasPayload(page, "whiteboard");
    return !!payload && typeof payload === "object" && "elements" in payload && Array.isArray(payload.elements) ? payload.elements.length : 0;
  }).toBe(1);
  await page.reload();
  await waitForWorkspace(page);
  await expect(page.locator(".excalidraw").first()).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  const saved = await readSavedDiagram(page, "Whiteboard (recovered draft)");
  if (!saved) throw new Error("Whiteboard was not recovered");
  // Seed invalid stored evidence while no editor can autosave over the fixture.
  await page.goto("/about");
  await page.evaluate(async (id) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("diagrammatic.library");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("documents", "readwrite");
        const store = tx.objectStore("documents");
        const get = store.get(id);
        get.onsuccess = () => store.put({
          ...get.result,
          versions: [{ id: "bad-version", label: "Invalid scene fixture", createdAt: 1, payload: { elements: [null] } }],
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, saved.id);
  await page.goto(`/diagrammatic?mode=whiteboard&document=${encodeURIComponent(saved.id)}`);
  await waitForWorkspace(page);
  await expect(page.locator(".excalidraw").first()).toBeVisible();
  const before = await readCanvasPayload(page, "whiteboard") as {
    elements: unknown[]; files: Record<string, unknown>;
    appState?: { viewBackgroundColor?: string; isLoading?: boolean };
  };
  expect(before.appState?.viewBackgroundColor).toBe("#05080d");
  expect(before.appState?.isLoading).toBeUndefined();
  await page.getByRole("button", { name: "Toggle version history", exact: true }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Invalid scene fixture" });
  await row.hover();
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Restore version", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Snapshot could not be restored/ })).toBeVisible();
  const after = await readCanvasPayload(page, "whiteboard") as typeof before;
  expect(normalizedBindings(after.elements)).toEqual(normalizedBindings(before.elements));
  expect(after.files).toEqual(before.files);
  expect(after.appState?.viewBackgroundColor).toBe("#05080d");
});

test("native geometry and arrow bindings survive persistence and valid snapshot restoration", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/diagrammatic?mode=whiteboard");
  const canvas = page.locator(".excalidraw").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing Whiteboard bounds");
  async function draw(tool: string, x: number, y: number, endX: number, endY: number) {
    await page.locator("label").filter({ has: page.getByRole("radio", { name: tool, exact: true }) }).click();
    await page.mouse.move(box!.x + x, box!.y + y);
    await page.mouse.down();
    await page.mouse.move(box!.x + endX, box!.y + endY, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.press("Escape");
  }
  await draw("Rectangle", 300, 200, 450, 340);
  await draw("Rectangle", 650, 200, 800, 340);
  await draw("Arrow", 455, 270, 645, 270);
  await expect.poll(async () => {
    const payload = await readCanvasPayload(page, "whiteboard") as { elements?: Array<{ type: string; startBinding?: unknown; endBinding?: unknown }> } | undefined;
    return payload?.elements?.filter((element) => element.type === "arrow" && element.startBinding && element.endBinding).length;
  }).toBe(1);
  await page.getByRole("button", { name: "Toggle version history", exact: true }).click();
  await page.getByPlaceholder("Snapshot label (optional)").fill("Bound drawing");
  await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
  await page.getByRole("button", { name: "Close versions", exact: true }).click();
  await page.reload();
  await expect(canvas).toBeVisible();
  const before = await readCanvasPayload(page, "whiteboard") as { elements: Array<{ id: string; type: string; x: number; y: number; width: number; height: number; startBinding?: unknown; endBinding?: unknown }> };
  const geometry = before.elements.map(({ id, type, x, y, width, height, startBinding, endBinding }) => ({ id, type, x, y, width, height, startBinding, endBinding }));
  expect(geometry).toHaveLength(3);
  await page.getByRole("button", { name: "Toggle version history", exact: true }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Bound drawing" });
  await row.hover();
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Restore version", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Snapshot could not be restored/ })).toHaveCount(0);
  await expect.poll(async () => {
    const restored = await readCanvasPayload(page, "whiteboard") as typeof before;
    return restored.elements.map(({ id, type, x, y, width, height, startBinding, endBinding }) => ({ id, type, x, y, width, height, startBinding, endBinding }));
  }).toEqual(geometry);
});
