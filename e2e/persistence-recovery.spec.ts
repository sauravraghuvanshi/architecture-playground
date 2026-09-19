import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readSavedDiagram } from "./read-saved-diagram";

const node = { id: "retained", kind: "shape", shape: "rectangle", label: "Keep this design", x: 100, y: 100 };
test.describe.configure({ timeout: 90_000 });

async function nameCurrent(page: Page, name: string) {
  await page.getByRole("button", { name: "My diagrams", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Saved diagrams", exact: true });
  await dialog.getByLabel("Diagram name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Save current diagram", exact: true }).click();
  await expect(dialog.getByText(`Saved "${name}" in this browser.`, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close diagram library" }).click();
}

test("an unnamed architecture survives refresh before its debounce fires", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByText("Component", { exact: true }).last()).toBeVisible();
});

test("browser Back preserves the live scratch architecture", async ({ page }) => {
  await page.goto("/");
  await page.goto("/diagrammatic?mode=architecture");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/diagrammatic?mode=architecture");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});

test("a Whiteboard symbol and its binary survive immediate refresh", async ({ page }) => {
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill("user");
  await page.getByRole("button", { name: "User", exact: true }).first().click();
  await page.reload();
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => {
    const document = await readSavedDiagram(page, "Whiteboard (recovered draft)");
    const payload = document?.payload as { elements?: Array<{ type: string; fileId?: string }>; files?: Record<string, { dataURL?: string }> } | undefined;
    const image = payload?.elements?.find((element) => element.type === "image");
    return image?.fileId ? payload?.files?.[image.fileId]?.dataURL?.startsWith("data:") : false;
  }).toBe(true);
});

test("corrupted Whiteboard data stays recoverable while a healthy named architecture opens", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "healthy.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ nodes: [node], edges: [] })),
  });
  await nameCurrent(page, "Healthy architecture");
  const preserved = (await readSavedDiagram(page, "Healthy architecture"))?.payload;
  await page.evaluate(() => localStorage.setItem("diagrammatic.draft.whiteboard", "{broken"));
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByRole("alert").filter({ hasText: "Whiteboard" })).toBeVisible();
  const [recoveryDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download recovery data", exact: true }).click(),
  ]);
  const recoveryPath = await recoveryDownload.path();
  expect(recoveryPath).not.toBeNull();
  const recoveredData: Array<{ storageKey?: string; originalData?: string }> =
    JSON.parse(await readFile(recoveryPath!, "utf8"));
  expect(recoveredData.find((entry) => entry.storageKey === "diagrammatic.draft.whiteboard")?.originalData).toBe("{broken");
  await page.getByRole("tab", { name: "Whiteboard", exact: true }).click();
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill("user");
  await page.getByRole("button", { name: "User", exact: true }).first().click();
  expect(await page.evaluate(() => localStorage.getItem("diagrammatic.draft.whiteboard"))).toBe("{broken");
  await page.getByRole("button", { name: "Save recovery copy", exact: true }).click();
  await expect.poll(async () => (await readSavedDiagram(page, "Whiteboard (recovery copy)"))?.mode).toBe("whiteboard");
  expect(await page.evaluate(() => localStorage.getItem("diagrammatic.draft.whiteboard"))).toBe("{broken");
  expect((await readSavedDiagram(page, "Healthy architecture"))?.payload).toEqual(preserved);
});

test("scratch quota failure warns before reload and keeps the current canvas", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "diagrammatic.draft") throw new DOMException("Injected quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const dialogPromise = page.waitForEvent("dialog");
  await page.evaluate(() => { window.setTimeout(() => location.reload(), 0); });
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: /storage|save|preserv/i }).last()).toBeVisible();
});

test("a failed IndexedDB save prevents mode switching without losing edits", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await nameCurrent(page, "Quota protected");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "documents") throw new DOMException("Injected quota", "QuotaExceededError");
      return original.call(this, value, key);
    };
  });
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await page.getByRole("tab", { name: "Whiteboard", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Cloud Architecture", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Save recovery copy", exact: true })).toBeVisible();
  const stored = (await readSavedDiagram(page, "Quota protected"))?.payload as { nodes: unknown[] };
  expect(stored.nodes).toHaveLength(1);
});

test("named pending edits warn on refresh and can be saved after cancelling navigation", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await nameCurrent(page, "Pending named edit");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  const dialogPromise = page.waitForEvent("dialog");
  await page.evaluate(() => { window.setTimeout(() => location.reload(), 0); });
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.keyboard.press("Control+s");
  await expect.poll(async () => {
    const payload = (await readSavedDiagram(page, "Pending named edit"))?.payload as { nodes?: unknown[] } | undefined;
    return payload?.nodes?.length;
  }).toBe(1);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});
