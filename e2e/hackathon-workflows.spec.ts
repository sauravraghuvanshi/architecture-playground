import { expect, test } from "@playwright/test";
import { readSavedDiagram } from "./read-saved-diagram";
import { parseArchitectureDocument } from "../lib/architecture-document";

const diagram = {
  nodes: [
    { kind: "group", id: "tier", label: "Workload", x: 0, y: 0, width: 600, height: 300 },
    { kind: "shape", id: "api", label: "Customer API", shape: "rectangle", x: 30, y: 70, width: 128, height: 104, parentId: "tier" },
    { kind: "shape", id: "db", label: "Orders", shape: "database", x: 300, y: 70, width: 128, height: 104, parentId: "tier" },
  ],
  edges: [{ id: "flow", source: "api", target: "db", label: "TLS", style: "dashed", step: 3 }],
};

test("imports exported architecture JSON without losing evidence or flow configuration", async ({ page }) => {
  await page.goto("/diagrammatic");
  await page.locator('input[type="file"][aria-label="Architecture JSON file"]').setInputFiles({
    name: "architecture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(diagram)),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("diagrammatic.draft") ?? "{}").payload)).toEqual(parseArchitectureDocument(diagram));
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON · re-importable" }).click();
  const result = await download;
  const stream = await result.createReadStream();
  if (!stream) throw new Error("Export was not readable");
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(parseArchitectureDocument(diagram));
});

test("invalid JSON imports leave the active architecture untouched", async ({ page }) => {
  await page.addInitScript((payload) => localStorage.setItem("diagrammatic.draft", JSON.stringify({ mode: "architecture", payload })), diagram);
  await page.goto("/diagrammatic");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "broken.json", mimeType: "application/json", buffer: Buffer.from('{"nodes":[],"edges":[{"id":"x","source":"missing","target":"bad"}]}'),
  });
  await expect(page.getByRole("status").filter({ hasText: "Import failed" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
});

test("saving another mode as a named document does not overwrite the architecture draft", async ({ page }) => {
  await page.addInitScript((payload) => localStorage.setItem("diagrammatic.draft", JSON.stringify({ mode: "architecture", payload })), diagram);
  await page.goto("/diagrammatic?mode=flowchart");
  await expect(page.getByRole("tab", { name: "Flowchart", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "My diagrams", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Saved diagrams", exact: true });
  await library.getByLabel("Diagram name", { exact: true }).fill("Flowchart handoff");
  await library.getByRole("button", { name: "Save current diagram", exact: true }).click();
  await expect(library.getByText('Saved "Flowchart handoff" in this browser.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("diagrammatic.draft") ?? "{}").payload)).toEqual(diagram);
  expect(await readSavedDiagram(page, "Flowchart handoff")).toMatchObject({
    mode: "flowchart",
    payload: { nodes: expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })]) },
  });
});

test("restoring a same-size snapshot restores labels and preserves comments after reload", async ({ page }) => {
  await page.goto("/diagrammatic");
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "original.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(diagram)),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.getByRole("button", { name: "Toggle version history" }).click();
  await page.getByPlaceholder("Snapshot label (optional)").fill("Customer baseline");
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText("Customer baseline", { exact: true })).toBeVisible();
  const changed = { ...diagram, nodes: diagram.nodes.map((node) => node.id === "api" ? { ...node, label: "Changed API" } : node) };
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "changed.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(changed)),
  });
  await expect(page.locator(".react-flow__node").filter({ hasText: "Changed API" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore version" }).click();
  await expect(page.locator(".react-flow__node").filter({ hasText: "Customer API" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle comments" }).click();
  await page.getByPlaceholder(/Add a comment/).fill("Confirm recovery objectives with the customer.");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(page.getByText("Confirm recovery objectives with the customer.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Toggle comments" }).click();
  await expect(page.getByText("Confirm recovery objectives with the customer.")).toBeVisible();
});

test("whiteboard image style is submitted and failed GIF does not silently download PNG", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { diagramConfigured: true, imageConfigured: true } }));
  let sent: unknown;
  await page.route("**/api/ai/image", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 429, json: { error: "Rate limit exceeded" } });
  });
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  await page.getByLabel("Describe the image to generate").fill("An order processing flow");
  await page.getByLabel("Visual style").selectOption("executive");
  await page.getByRole("button", { name: "Generate image" }).click();
  await expect(page.getByText("Rate limit exceeded", { exact: true })).toBeVisible();
  expect(sent).toMatchObject({ style: "executive", prompt: "An order processing flow" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  let downloads = 0;
  page.on("download", () => { downloads++; });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "GIF · ordered request flow" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draw at least one Flow arrow" })).toBeVisible();
  expect(downloads).toBe(0);
});

test("image API rejects malformed and oversized requests without invoking a model", async ({ request }) => {
  const invalid = await request.post("/api/ai/image", { data: { prompt: 42 } });
  expect(invalid.status()).toBe(400);
  const unknownStyle = await request.post("/api/ai/image", { data: { prompt: "A diagram", style: "unknown" } });
  expect(unknownStyle.status()).toBe(400);
  const oversized = await request.post("/api/ai/image", { data: { prompt: "x".repeat(20_000) } });
  expect(oversized.status()).toBe(413);
});

test("architecture drag undo and a new edit after undo both retain history", async ({ page }) => {
  await page.goto("/diagrammatic");
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "history.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(diagram)),
  });
  const node = page.locator('.react-flow__node[data-id="api"]');
  await expect(node).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("diagrammatic.draft") ?? "{}").payload?.nodes?.find((node: { id: string }) => node.id === "api")?.x)).toBe(30);
  const move = async () => {
    const box = await node.boundingBox();
    if (!box) throw new Error("Node unavailable");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 75, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
  };
  const x = () => page.evaluate(() => JSON.parse(localStorage.getItem("diagrammatic.draft") ?? "{}").payload?.nodes?.find((node: { id: string }) => node.id === "api")?.x);
  await move();
  await expect.poll(x).not.toBe(30);
  await page.keyboard.press("Control+z");
  await expect.poll(x).toBe(30);
  await move();
  await expect.poll(x).not.toBe(30);
  await page.keyboard.press("Control+z");
  await expect.poll(x).toBe(30);
});
