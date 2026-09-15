import { expect, test, type Page } from "@playwright/test";

async function savedDocuments(page: Page) {
  return page.evaluate(() => new Promise<Array<{
    id: string; name: string; mode: string; labels: string[]; files: number; elements: number;
    comments: string[]; versions: number; edgeStyles: string[];
  }>>((resolve, reject) => {
    const request = indexedDB.open("diagrammatic.library");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("documents", "readonly");
      const get = tx.objectStore("documents").getAll();
      get.onerror = () => { db.close(); reject(get.error); };
      get.onsuccess = () => {
        const records: Array<{
          id: string; name: string; mode: string;
          payload: { nodes?: Array<{ label: string }>; edges?: Array<{ style: string }>; elements?: unknown[]; files?: object };
          comments: Array<{ body: string }>; versions: unknown[];
        }> = get.result;
        resolve(records.map((document) => ({
          id: document.id, name: document.name, mode: document.mode,
          labels: document.payload.nodes?.map((node) => node.label) ?? [],
          files: Object.keys(document.payload.files ?? {}).length,
          elements: document.payload.elements?.length ?? 0,
          comments: document.comments.map((comment) => comment.body), versions: document.versions.length,
          edgeStyles: document.payload.edges?.map((edge) => edge.style) ?? [],
        })));
        db.close();
      };
    };
  }));
}

async function nameCurrent(page: Page, name: string) {
  await page.getByRole("button", { name: "My diagrams", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Saved diagrams", exact: true });
  await library.getByLabel("Diagram name", { exact: true }).fill(name);
  await library.getByRole("button", { name: "Save current diagram", exact: true }).click();
  await expect(library.getByText(`Saved "${name}" in this browser.`, { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Close diagram library" }).click();
}

test("hub recent documents reopen the named canvas through a persistent deep link", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/diagrammatic?mode=architecture");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await nameCurrent(page, "Hub saved example");
  const document = (await savedDocuments(page)).find((record) => record.name === "Hub saved example");
  expect(document).toBeDefined();
  await page.goto("/");
  await page.getByText("Hub saved example", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`document=${document!.id}`));
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Review my architecture", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deploy architecture to Azure", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Templates", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CSA guidance", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: "New diagram", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await nameCurrent(page, "Hub replacement");
  const replacement = (await savedDocuments(page)).find((record) => record.name === "Hub replacement");
  expect(replacement).toBeDefined();
  await expect(page).toHaveURL(new RegExp(`document=${replacement!.id}`));
  await page.reload();
  await expect(page.getByText("Hub replacement / Cloud Architecture", { exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  expect((await savedDocuments(page)).find((record) => record.name === "Hub saved example")?.labels).toHaveLength(1);
});

test("switching modes flushes outgoing edits without waiting for autosave", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/diagrammatic?mode=architecture");
  await nameCurrent(page, "Before mode switch");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await page.getByRole("tab", { name: "Flowchart", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Flowchart", exact: true })).toHaveAttribute("aria-selected", "true");
  expect((await savedDocuments(page)).find((record) => record.name === "Before mode switch")?.labels).toHaveLength(1);
  await page.reload();
  await page.getByRole("tab", { name: "Cloud Architecture", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await page.getByRole("link", { name: "Back to project hub", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await savedDocuments(page)).find((record) => record.name === "Before mode switch")?.labels).toHaveLength(2);
});

test("a cross-tab conflict can save a recovery copy without overwriting the remote revision", async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto("/diagrammatic?mode=architecture");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await nameCurrent(page, "Shared design");
  const secondTab = await context.newPage();
  await secondTab.goto(page.url());
  await expect(secondTab.locator(".react-flow__node")).toHaveCount(1);
  await secondTab.getByRole("button", { name: "Component", exact: true }).click();
  await secondTab.keyboard.press("Control+s");
  await expect.poll(async () => (await savedDocuments(secondTab)).find((record) => record.name === "Shared design")?.labels.length).toBe(2);
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.keyboard.press("Control+s");
  await page.getByRole("button", { name: "Save recovery copy", exact: true }).click();
  await expect.poll(async () => (await savedDocuments(page)).find((record) => record.name === "Shared design (recovery copy)")?.labels.length).toBe(3);
  expect((await savedDocuments(page)).find((record) => record.name === "Shared design")?.labels).toHaveLength(2);
  await secondTab.close();
});

test("named architecture saves, creates another, reopens, edits and retains isolated comments and versions", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/diagrammatic");
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "customer.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      nodes: [{ id: "api", kind: "shape", shape: "rectangle", label: "Customer A API", x: 0, y: 0 }],
      edges: [],
    })),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await nameCurrent(page, "Customer A");
  await page.getByRole("button", { name: "Toggle comments" }).click();
  await page.getByPlaceholder(/Add a comment/).fill("Validate Customer A recovery target.");
  await page.getByRole("button", { name: "Send comment" }).click();
  await page.getByRole("button", { name: "Toggle version history" }).click();
  await page.getByPlaceholder("Snapshot label (optional)").fill("Baseline A");
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect.poll(async () => (await savedDocuments(page)).find((document) => document.name === "Customer A")?.versions).toBe(1);

  await page.getByRole("button", { name: "New diagram", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await nameCurrent(page, "Customer B");
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect.poll(async () => (await savedDocuments(page)).find((document) => document.name === "Customer B")?.labels.length).toBe(1);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: "My diagrams", exact: true }).click();
  await page.getByRole("button", { name: "Open diagram Customer A", exact: true }).click();
  await expect(page.locator(".react-flow__node").filter({ hasText: "Customer A API" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle comments" }).click();
  await expect(page.getByText("Validate Customer A recovery target.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect.poll(async () => (await savedDocuments(page)).find((document) => document.name === "Customer A")?.labels.length).toBe(2);
  const records = await savedDocuments(page);
  expect(records.find((document) => document.name === "Customer B")?.comments).toEqual([]);
  expect(records.find((document) => document.name === "Customer B")?.versions).toBe(0);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("Whiteboard image binaries survive New, reopening and a fresh page load", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 30_000 });
  await page.locator('button[title^="Click or drag to insert"]').first().click();
  await nameCurrent(page, "Workshop A");
  await expect.poll(async () => (await savedDocuments(page)).find((document) => document.name === "Workshop A")?.files).toBe(1);
  await page.getByRole("button", { name: "New diagram", exact: true }).click();
  await nameCurrent(page, "Workshop B");
  await page.reload();
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "My diagrams", exact: true }).click();
  await page.getByRole("button", { name: "Open diagram Workshop A", exact: true }).click();
  await expect(page.locator(".excalidraw")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /PNG/ }).click();
  const image = await download;
  expect(image.suggestedFilename()).toMatch(/\.png$/);
  const docs = await savedDocuments(page);
  expect(docs.find((document) => document.name === "Workshop A")?.files).toBe(1);
  expect(docs.find((document) => document.name === "Workshop A")?.elements).toBeGreaterThan(0);
  expect(docs.find((document) => document.name === "Workshop B")?.files).toBe(0);
});

test("legacy drafts are recovered and library rename and deletion persist", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("diagrammatic.draft", JSON.stringify({ mode: "architecture", savedAt: 1000, payload: {
        nodes: [{ id: "old", kind: "shape", shape: "rectangle", label: "Old draft", x: 0, y: 0 }], edges: [],
      } }));
      sessionStorage.setItem("seeded", "true");
    }
  });
  await page.goto("/diagrammatic?library=1");
  const library = page.getByRole("dialog", { name: "Saved diagrams", exact: true });
  await expect(library).toBeVisible();
  await expect(library.getByRole("button", { name: "Open diagram Cloud Architecture (recovered draft)", exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Rename diagram Cloud Architecture (recovered draft)", exact: true }).click();
  await library.getByLabel("New name for Cloud Architecture (recovered draft)").fill("Recovered customer diagram");
  await library.getByRole("button", { name: "Save name for Cloud Architecture (recovered draft)", exact: true }).click();
  await expect.poll(async () => (await savedDocuments(page)).some((document) => document.name === "Recovered customer diagram")).toBe(true);
  await library.getByRole("button", { name: "Delete diagram Recovered customer diagram", exact: true }).click();
  await library.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect.poll(async () => (await savedDocuments(page)).length).toBe(0);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect.poll(async () => (await savedDocuments(page)).length).toBe(0);
});
