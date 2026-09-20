import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import manifest from "../content/cloud-icons.json";
import type { ArchPayload } from "../components/diagrammatic/modes/architecture/ArchitectureCanvas";
import type { PlaygroundGraph } from "../components/playground/lib/types";
import { readSavedDiagram } from "./read-saved-diagram";
import { parseArchitectureDocument } from "../lib/architecture-document";

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1440, height: 1000 } });
const icon = manifest.icons[0];
const group = { id: "tier", kind: "group" as const, label: "Compute boundary", tier: "Compute", x: 100.25, y: 100.5, width: 500.5, height: 380.25 };
const service = { id: "service", kind: "icon" as const, label: "API \u2192 workload", subtitle: "Customer-owned", iconId: icon.id, iconPath: icon.path, x: 40.25, y: 60.5, width: 180.5, height: 140.25, parentId: "tier" };
const shape = { id: "data", kind: "shape" as const, shape: "database" as const, label: "Data", subtitle: "Retain geometry", x: 750.25, y: 200.5, width: 200.5, height: 130.25 };
const edge = { id: "request", source: "service", target: "data", sourceHandle: "bottom" as const, targetHandle: "right" as const, label: "TLS \u2192 v2", style: "dashed" as const, step: 137 };
const fixture: ArchPayload = { nodes: [service, group, shape], edges: [edge] };
const normalized = parseArchitectureDocument({ nodes: [group, service, shape], edges: [edge] });

async function importGraph(page: Page, graph: unknown, replace = false) {
  if (replace) page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "roundtrip.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(graph)),
  });
}
async function exportGraph(page: Page): Promise<ArchPayload> {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^JSON .+re-importable$/ }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Architecture JSON download is unavailable");
  return JSON.parse(await readFile(path, "utf8"));
}
async function saveNamed(page: Page, name: string) {
  await page.getByRole("button", { name: "My diagrams", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Saved diagrams", exact: true });
  await dialog.getByLabel("Diagram name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Save current diagram", exact: true }).click();
  await expect(dialog.getByText(`Saved "${name}" in this browser.`, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close diagram library" }).click();
}
async function openFixture(page: Page, graph: ArchPayload = fixture) {
  await page.goto("/diagrammatic?mode=architecture");
  await importGraph(page, graph);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator('.react-flow__node[data-id="service"] > div').first()).toHaveCSS("width", "180.5px");
  await expect(page.locator('.react-flow__node[data-id="data"] > div').first()).toHaveCSS("width", "200.5px");
}

test("JSON, named save and reload preserve handles, identities, grouping and fractional geometry", async ({ page }) => {
  await openFixture(page);
  expect(await exportGraph(page)).toEqual(normalized);
  await saveNamed(page, "Lossless architecture");
  expect((await readSavedDiagram(page, "Lossless architecture"))?.payload).toEqual(normalized);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  expect(await exportGraph(page)).toEqual(normalized);
  await importGraph(page, await exportGraph(page), true);
  await expect(page.getByRole("button", { name: "Select connection 137 TLS \u2192 v2" })).toBeVisible();
  expect(await exportGraph(page)).toEqual(normalized);
});

test("a real bottom-to-right connection retains its visible routing after reopening", async ({ page }) => {
  await openFixture(page, { nodes: fixture.nodes, edges: [] });
  const source = page.locator('.react-flow__node[data-id="service"] [data-handleid="bottom"]');
  const target = page.locator('.react-flow__node[data-id="data"] [data-handleid="right"]');
  await source.hover();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Connection handles unavailable");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 16 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  const connected = await exportGraph(page);
  expect(connected.edges[0]).toMatchObject({ source: "service", target: "data", sourceHandle: "bottom", targetHandle: "right" });
  const route = await page.locator(".react-flow__edge-path").getAttribute("d");
  await saveNamed(page, "Connected sides");
  await page.reload();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  expect(await exportGraph(page)).toEqual(connected);
  await expect(page.locator(".react-flow__edge-path")).toHaveAttribute("d", route!);
});

test("version restoration preserves edge handles and same-sized document geometry", async ({ page }) => {
  await openFixture(page);
  await saveNamed(page, "Versioned roundtrip");
  await page.getByRole("button", { name: "Toggle version history" }).click();
  await page.getByPlaceholder("Snapshot label (optional)").fill("Exact geometry");
  await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
  await expect.poll(async () => (await readSavedDiagram(page, "Versioned roundtrip"))?.versions.length).toBe(1);
  await importGraph(page, { ...fixture, edges: [{ ...edge, sourceHandle: "left", targetHandle: "top", step: 900 }] }, true);
  expect((await exportGraph(page)).edges[0].sourceHandle).toBe("left");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore version", exact: true }).click();
  expect(await exportGraph(page)).toEqual(normalized);
});

test("invalid handles and hierarchy are rejected without replacing a valid canvas", async ({ page }) => {
  await openFixture(page);
  for (const input of [
    { ...fixture, edges: [{ ...edge, sourceHandle: "unknown" }] },
    { ...fixture, nodes: [service, { ...group, parentId: "tier" }, shape] },
    { ...fixture, nodes: [{ ...service, parentId: "missing" }, group, shape] },
    { ...fixture, nodes: [{ ...service, width: -1 }, group, shape] },
  ]) {
    await importGraph(page, input);
    await expect(page.getByRole("status").filter({ hasText: "Import failed:" })).toBeVisible();
    expect(await exportGraph(page)).toEqual(normalized);
  }
});

test("older architecture JSON without handle fields retains default behavior", async ({ page }) => {
  const legacy: ArchPayload = { nodes: fixture.nodes, edges: [{ id: "older", source: "service", target: "data", label: "HTTPS", style: "solid", step: 1 }] };
  await openFixture(page, legacy);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  const exported = await exportGraph(page);
  expect(exported.nodes).toEqual(normalized.nodes);
  expect(exported.edges).toEqual(legacy.edges);
  await saveNamed(page, "Older compatible diagram");
  await page.reload();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  expect(await exportGraph(page)).toEqual(exported);
});

test("native playback editor rejects out-of-range values without making the diagram unsavable", async ({ page }) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Select connection 137 TLS \u2192 v2", exact: true }).click();
  const order = page.getByRole("spinbutton", { name: /GIF \/ playback order/ });
  await expect(order).toHaveAttribute("max", "100000");
  await order.fill("100001");
  await order.blur();
  expect(await order.evaluate((element) => (element as HTMLInputElement).validity.rangeOverflow)).toBe(true);
  expect(await exportGraph(page)).toEqual(normalized);
  await order.fill("50000");
  await order.blur();
  expect((await exportGraph(page)).edges[0].step).toBe(50000);
});

test("unsupported template handoff reports an error and retains the original handoff and saved diagram", async ({ page }) => {
  await openFixture(page);
  await saveNamed(page, "Protected template source");
  const handoff = JSON.stringify({
    graph: {
      nodes: [{ id: "nested", type: "group", parentId: "nested", position: { x: 0, y: 0 }, data: { label: "Invalid nesting", variant: "custom" }, width: 440, height: 220 }],
      edges: [],
    },
  });
  await page.evaluate((value) => localStorage.setItem("architecture-playground:template-handoff:invalid-p3", value), handoff);
  await page.goto("/diagrammatic?templateHandoff=invalid-p3");
  await expect(page.getByRole("status").filter({ hasText: "Template could not be opened:" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("architecture-playground:template-handoff:invalid-p3"))).toBe(handoff);
  expect((await readSavedDiagram(page, "Protected template source"))?.payload).toEqual(normalized);
});

test("legacy connections retain named sides and a stage above 100 through JSON import/export", async ({ page }) => {
  await page.goto("/legacy-playground");
  const graph = {
    nodes: [
      { id: "source", type: "service", position: { x: 100, y: 100 }, data: { iconId: icon.id, label: "Source", cloud: icon.cloud } },
      { id: "target", type: "service", position: { x: 550, y: 280 }, data: { iconId: icon.id, label: "Target", cloud: icon.cloud } },
    ],
    edges: [],
  };
  const input = page.locator('input[type="file"][accept*=".json"]');
  await input.setInputFiles({ name: "legacy.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(graph)) });
  await expect(page.locator(".react-flow__node-service")).toHaveCount(2);
  const source = page.locator('.react-flow__node[data-id="source"] [data-handleid="bottom"]');
  const target = page.locator('.react-flow__node[data-id="target"] [data-handleid="left"]');
  await source.hover();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Legacy side handles are unavailable");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 16 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  async function exported(): Promise<PlaygroundGraph> {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export JSON", exact: true }).click(),
    ]);
    const path = await download.path();
    if (!path) throw new Error("Legacy JSON export is unavailable");
    return JSON.parse(await readFile(path, "utf8")).graph;
  }
  const connected = await exported();
  expect(connected.edges[0]).toMatchObject({ sourceHandle: "bottom", targetHandle: "left" });
  const staged = { ...connected, edges: connected.edges.map((edge) => ({ ...edge, data: { ...edge.data, step: 137 } })) };
  await input.setInputFiles({ name: "staged.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ version: 2, graph: staged })) });
  await expect.poll(async () => (await exported()).edges[0].data?.step).toBe(137);
  expect((await exported()).edges[0]).toMatchObject({ sourceHandle: "bottom", targetHandle: "left", data: { step: 137 } });
});
