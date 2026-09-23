import { expect, test, type Page } from "@playwright/test";
import type { ArchPayload } from "../lib/architecture-model";
import { DIAGRAM_LIBRARY_DATABASE, DIAGRAM_LIBRARY_VERSION, summarizeDiagram, type DiagramRecord } from "../lib/diagram-library";
import { readSavedDiagram } from "./read-saved-diagram";
import { waitForWorkspace } from "./wait-for-workspace";

const architecture: ArchPayload = {
  metadata: { name: "Older imported title" },
  nodes: [
    { id: "client", kind: "shape", shape: "person", label: "Customer", x: 0, y: 0 },
    { id: "api", kind: "shape", shape: "rectangle", label: "Orders API", x: 240, y: 0 },
    { id: "database", kind: "shape", shape: "database", label: "Orders database", x: 480, y: 0 },
    { id: "audit", kind: "shape", shape: "document", label: "Audit log", x: 480, y: 200 },
  ],
  // Deliberately unsorted, sparse and parallel: native steps are not edge indexes.
  edges: [
    { id: "reply", source: "api", target: "client", label: "Return response", step: 12 },
    { id: "request", source: "client", target: "api", label: "Send request", step: 2 },
    { id: "background", source: "database", target: "audit", label: "Unsequenced maintenance" },
    { id: "read", source: "api", target: "database", label: "Read order", step: 7 },
    { id: "log", source: "client", target: "audit", label: "Log request", step: 2 },
  ],
};

function savedDocument(overrides: Partial<DiagramRecord> = {}): DiagramRecord {
  return {
    schemaVersion: 1, id: "presentation-demo", name: "Saved demo architecture", mode: "architecture",
    payload: architecture, canvasTheme: "dark", revision: 4, createdAt: 1, updatedAt: 4,
    comments: [{ id: "comment", body: "Keep the original", author: "Demo owner", createdAt: 2 }],
    versions: [{ id: "version", label: "Original snapshot", payload: architecture, createdAt: 3 }],
    ...overrides,
  };
}

async function seedSavedDocument(page: Page, record: DiagramRecord) {
  await page.goto("/about");
  await page.evaluate(({ database, version, record, summary }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(database, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("documents")) db.createObjectStore("documents", { keyPath: "id" });
      if (!db.objectStoreNames.contains("summaries")) db.createObjectStore("summaries", { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(["documents", "summaries"], "readwrite");
      transaction.objectStore("documents").put(record);
      transaction.objectStore("summaries").put(summary);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), {
    database: DIAGRAM_LIBRARY_DATABASE, version: DIAGRAM_LIBRARY_VERSION,
    record, summary: summarizeDiagram(record),
  });
  await page.goto(`/presentation/${record.id}`);
}

test("local saved architecture presents ordered parallel steps, reloads and exits without changing the original", async ({ page }) => {
  const removedApiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/diagrams/")) removedApiRequests.push(request.url());
  });
  const record = savedDocument();
  await seedSavedDocument(page, record);
  await expect(page.getByRole("heading", { name: record.name, exact: true })).toBeVisible();
  const main = page.getByRole("main");
  const progress = page.getByRole("banner");
  await expect(progress).toContainText("Step 0 / 3");
  await expect(main).toContainText("Press → to begin.");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Backspace");
  await expect(progress).toContainText("Step 0 / 3");

  await page.keyboard.press("Space");
  await expect(progress).toContainText("Step 1 / 3");
  await expect(main).toContainText("Sequence step 2");
  await expect(main.getByRole("region")).toHaveCount(2);
  await expect(main.getByRole("region", { name: "Send request", exact: true })).toContainText("Orders API");
  await expect(main.getByRole("region", { name: "Log request", exact: true })).toContainText("Audit log");
  await expect(main).not.toContainText("Return response");
  await expect(main).not.toContainText("Unsequenced maintenance");

  await page.keyboard.press("ArrowRight");
  await expect(progress).toContainText("Step 2 / 3");
  await expect(main).toContainText("Sequence step 7");
  await expect(main.getByRole("region", { name: "Read order", exact: true })).toContainText("Orders database");
  await page.keyboard.press("Enter");
  await expect(progress).toContainText("Step 3 / 3");
  await expect(main).toContainText("Sequence step 12");
  await expect(main.getByRole("region", { name: "Return response", exact: true })).toContainText("Customer");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(progress).toContainText("Step 3 / 3");

  await page.keyboard.press("Backspace");
  await expect(main).toContainText("Sequence step 7");
  await page.keyboard.press("ArrowLeft");
  await expect(main).toContainText("Sequence step 2");
  expect(await readSavedDiagram(page, record.name)).toEqual(record);
  await page.reload();
  await expect(page.getByRole("heading", { name: record.name, exact: true })).toBeVisible();
  await expect(progress).toContainText("Step 0 / 3");
  await page.keyboard.press("ArrowRight");
  await expect(main).toContainText("Sequence step 2");
  expect(await readSavedDiagram(page, record.name)).toEqual(record);
  expect(removedApiRequests).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(`/diagrammatic?mode=architecture&document=${record.id}`);
  await waitForWorkspace(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
});

test("the return link remains keyboard accessible", async ({ page }) => {
  const record = savedDocument();
  await seedSavedDocument(page, record);
  const link = page.getByRole("link", { name: "Return to diagram", exact: true });
  await expect(link).toHaveAttribute("href", `/diagrammatic?mode=architecture&document=${record.id}`);
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/diagrammatic?mode=architecture&document=${record.id}`);
});

test("missing local records explain recovery and return to My diagrams", async ({ page }) => {
  await page.goto("/presentation/not-saved-here");
  await expect(page.getByRole("alert", { name: "Could not load diagram." })).toContainText("This diagram is not saved in this browser.");
  await expect(page.getByRole("link", { name: "Open My diagrams", exact: true }))
    .toHaveAttribute("href", "/diagrammatic?mode=architecture&library=1");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/diagrammatic\?.*library=1/);
  await expect(page.getByRole("dialog", { name: "Saved diagrams", exact: true })).toBeVisible();
  await page.goto("/presentation/not-saved-here");
  await page.getByRole("link", { name: "Open My diagrams", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Saved diagrams", exact: true })).toBeVisible();
});

for (const [name, payload] of [
  ["missing architecture fields", { unexpected: true }],
  ["dangling connection", { ...architecture, edges: [{ id: "broken", source: "client", target: "missing", step: 1 }] }],
  ["unsupported version", { ...architecture, schemaVersion: 999 }],
] as const) {
  test(`rejects ${name} without overwriting the saved document`, async ({ page }) => {
    const record = savedDocument({ payload });
    await seedSavedDocument(page, record);
    const error = page.getByRole("alert", { name: "Could not load diagram." });
    await expect(error).toContainText("The saved architecture is invalid or uses an unsupported format.");
    await expect(error).toContainText("The saved original has not been changed.");
    await expect(page.getByRole("link", { name: "Open My diagrams", exact: true })).toBeVisible();
    expect(await readSavedDiagram(page, record.name)).toEqual(record);
    await page.reload();
    await expect(error).toBeVisible();
    expect(await readSavedDiagram(page, record.name)).toEqual(record);
  });
}

test("other saved document modes are explicitly unsupported and remain unchanged", async ({ page }) => {
  const record = savedDocument({ mode: "whiteboard", payload: { elements: [], appState: {}, files: {} } });
  await seedSavedDocument(page, record);
  await expect(page.getByRole("alert", { name: "Could not load diagram." })).toContainText("Presentation supports saved Cloud Architecture diagrams only.");
  await expect(page.getByRole("link", { name: "Open My diagrams", exact: true })).toBeVisible();
  expect(await readSavedDiagram(page, record.name)).toEqual(record);
});

test("unsequenced architecture has an actionable empty state", async ({ page }) => {
  const record = savedDocument({ payload: { ...architecture, edges: [] } });
  await seedSavedDocument(page, record);
  await expect(page.getByRole("main")).toContainText("This diagram has no sequenced edges.");
  await page.keyboard.press("Space");
  await expect(page.getByRole("banner")).toContainText("Step 0 / 0");
  await expect(page.getByRole("link", { name: "Return to diagram", exact: true }))
    .toHaveAttribute("href", `/diagrammatic?mode=architecture&document=${record.id}`);
  expect(await readSavedDiagram(page, record.name)).toEqual(record);
});
