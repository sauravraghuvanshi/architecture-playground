import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { ArchPayload } from "../components/diagrammatic/modes/architecture/ArchitectureCanvas";
import { readSavedDiagram } from "./read-saved-diagram";
import manifest from "../content/cloud-icons.json";
import { waitForWorkspace } from "./wait-for-workspace";

test.use({ viewport: { width: 1600, height: 1000 } });
test.describe.configure({ timeout: 90_000 });

const fixture: ArchPayload = {
  nodes: [
    { id: "app", kind: "shape", shape: "rectangle", label: "Application", x: 40, y: 70, width: 128, height: 104, parentId: "subnet" },
    { id: "subnet", kind: "group", tier: "Subnet", label: "Apps", x: 30, y: 70, width: 500, height: 280, parentId: "vnet" },
    { id: "vnet", kind: "group", tier: "Virtual Network", label: "Workload network", x: 35, y: 70, width: 700, height: 450, parentId: "lz" },
    { id: "lz", kind: "group", tier: "Landing Zone", label: "Production", x: 100, y: 50, width: 880, height: 620 },
    { id: "client", kind: "shape", shape: "person", label: "Client", x: -160, y: 180, width: 128, height: 104 },
  ],
  edges: [{ id: "https", source: "client", target: "app", sourceHandle: "right", targetHandle: "left", label: "HTTPS", style: "solid", step: 1 }],
};

async function exportGraph(page: Page): Promise<ArchPayload> {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^JSON .+re-importable$/ }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("No architecture JSON downloaded");
  return JSON.parse(await readFile(path, "utf8"));
}

async function openFixture(page: Page) {
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "boundaries.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
}

async function selectBoundary(page: Page, id: string) {
  await page.locator(`.react-flow__node[data-id="${id}"]`).getByText(
    fixture.nodes.find((node) => node.id === id)?.label ?? "", { exact: true },
  ).click();
  await expect(page.getByRole("combobox", { name: "Parent boundary", exact: true })).toBeVisible();
}

test("cloud boundary menu creates a real three-level hierarchy and contains newly added components", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  for (const [index, tier] of ["Landing Zone", "Virtual Network", "Subnet"].entries()) {
    await page.getByTitle("Add tier / swimlane group", { exact: true }).click();
    await page.locator("#architecture-boundaries").getByRole("button", { name: tier, exact: true }).click();
    await expect(page.locator(".react-flow__node-group")).toHaveCount(index + 1);
  }
  await page.getByTitle("Fit view (Ctrl+0)", { exact: true }).click();
  const graph = await exportGraph(page);
  const [lz, vnet, subnet] = graph.nodes;
  expect(lz).toMatchObject({ kind: "group", tier: "Landing Zone" });
  expect(vnet).toMatchObject({ tier: "Virtual Network", parentId: lz.id });
  expect(subnet).toMatchObject({ tier: "Subnet", parentId: vnet.id });
  for (const [parent, child] of [[lz, vnet], [vnet, subnet]]) {
    const a = await page.locator(`.react-flow__node[data-id="${parent.id}"]`).boundingBox();
    const b = await page.locator(`.react-flow__node[data-id="${child.id}"]`).boundingBox();
    if (!a || !b) throw new Error("Nested boundary unavailable");
    expect(b.x).toBeGreaterThan(a.x); expect(b.y).toBeGreaterThan(a.y);
    expect(b.x + b.width).toBeLessThanOrEqual(a.x + a.width + 1);
    expect(b.y + b.height).toBeLessThanOrEqual(a.y + a.height + 1);
  }
  await page.getByRole("button", { name: "Component", exact: true }).click();
  await expect(page.locator(".react-flow__node-shape")).toHaveCount(1);
  expect((await exportGraph(page)).nodes.find((node) => node.kind === "shape")?.parentId).toBe(subnet.id);
});

test("nested geometry, connection sides and boundary types survive named save/reload and export", async ({ page }) => {
  await openFixture(page);
  const graph = await exportGraph(page);
  expect(graph.nodes.map((node) => node.id)).toEqual(["lz", "vnet", "subnet", "app", "client"]);
  expect(graph.edges).toEqual(fixture.edges);
  for (const node of fixture.nodes) expect(graph.nodes.find((item) => item.id === node.id)).toEqual(node);
  await page.getByRole("button", { name: "My diagrams", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Saved diagrams", exact: true });
  await dialog.getByLabel("Diagram name", { exact: true }).fill("Nested production design");
  await dialog.getByRole("button", { name: "Save current diagram", exact: true }).click();
  await expect.poll(async () => (await readSavedDiagram(page, "Nested production design"))?.payload).toEqual(graph);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  expect(await exportGraph(page)).toEqual(graph);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"), page.getByRole("button", { name: /^PNG .+high resolution$/ }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("No nested diagram PNG downloaded");
  const bytes = await readFile(path);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.length).toBeGreaterThan(15_000);
});

test("Properties reparents/detaches boundaries with undo and prevents descendant cycles", async ({ page }) => {
  await openFixture(page);
  await selectBoundary(page, "lz");
  const parent = page.getByRole("combobox", { name: "Parent boundary", exact: true });
  await expect(parent.locator("option")).toHaveCount(1);
  await selectBoundary(page, "subnet");
  await parent.selectOption("lz");
  let graph = await exportGraph(page);
  expect(graph.nodes.find((node) => node.id === "subnet")).toMatchObject({ parentId: "lz", x: 65, y: 140 });
  await page.getByTitle("Undo (Ctrl+Z)", { exact: true }).click();
  expect((await exportGraph(page)).nodes.find((node) => node.id === "subnet")).toMatchObject({ parentId: "vnet", x: 30, y: 70 });
  await expect(parent).toHaveValue("vnet");
  await page.getByTitle("Redo (Ctrl+Y)", { exact: true }).click();
  await selectBoundary(page, "subnet");
  await parent.selectOption("");
  graph = await exportGraph(page);
  expect(graph.nodes.find((node) => node.id === "subnet")).toMatchObject({ x: 165, y: 190 });
  expect(graph.nodes.find((node) => node.id === "subnet")?.parentId).toBeUndefined();
  expect(graph.nodes.find((node) => node.id === "app")?.parentId).toBe("subnet");
});

test("deleting a landing-zone subtree removes all descendants and connections and undo restores them", async ({ page }) => {
  await openFixture(page);
  const graph = await exportGraph(page);
  await selectBoundary(page, "lz");
  await page.getByTitle("Delete selection (Del)", { exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await page.getByTitle("Undo (Ctrl+Z)", { exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  expect(await exportGraph(page)).toEqual(graph);
});

test("dragging an existing component into a subnet preserves its connection and has one undo", async ({ page }) => {
  await openFixture(page);
  const graph = await exportGraph(page);
  const source = await page.locator('.react-flow__node[data-id="client"]').boundingBox();
  const subnet = await page.locator('.react-flow__node[data-id="subnet"]').boundingBox();
  if (!source || !subnet) throw new Error("Drag targets unavailable");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(subnet.x + subnet.width * 0.72, subnet.y + subnet.height * 0.65, { steps: 20 });
  await page.mouse.up();
  const moved = await exportGraph(page);
  expect(moved.nodes.find((node) => node.id === "client")?.parentId).toBe("subnet");
  expect(moved.edges).toEqual(graph.edges);
  await page.getByTitle("Undo (Ctrl+Z)", { exact: true }).click();
  expect(await exportGraph(page)).toEqual(graph);
});

test("nested resizing expands ancestors and cannot shrink a boundary over its children", async ({ page }) => {
  await openFixture(page);
  const graph = await exportGraph(page);
  await selectBoundary(page, "subnet");
  const handle = page.locator('.react-flow__node[data-id="subnet"] .react-flow__resize-control.handle.bottom.right');
  async function resize(dx: number, dy: number) {
    await handle.hover();
    const box = await handle.boundingBox();
    if (!box) throw new Error("Subnet resize handle unavailable");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + dx, box.y + dy, { steps: 15 });
    await page.mouse.up();
  }
  await resize(180, 120);
  let resized = await exportGraph(page);
  const subnet = resized.nodes.find((node) => node.id === "subnet")!;
  const vnet = resized.nodes.find((node) => node.id === "vnet")!;
  expect(subnet.width).toBeGreaterThan(500);
  expect(vnet.width).toBeGreaterThanOrEqual(subnet.x + subnet.width! + 24);
  expect(vnet.height).toBeGreaterThanOrEqual(subnet.y + subnet.height! + 24);
  await page.getByTitle("Undo (Ctrl+Z)", { exact: true }).click();
  expect(await exportGraph(page)).toEqual(graph);
  await selectBoundary(page, "subnet");
  await resize(-200, -150);
  resized = await exportGraph(page);
  const smaller = resized.nodes.find((node) => node.id === "subnet")!;
  expect(smaller.width).toBeGreaterThanOrEqual(40 + 128 + 24);
  expect(smaller.height).toBeGreaterThanOrEqual(70 + 104 + 24);
  await page.getByTitle("Undo (Ctrl+Z)", { exact: true }).click();
  expect(await exportGraph(page)).toEqual(graph);
});

test("boundary and export disclosures work with keyboard focus without delayed dismissal", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await expect(page.locator(".react-flow__pane")).toBeVisible();
  await waitForWorkspace(page);
  const trigger = page.getByTitle("Add tier / swimlane group", { exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.locator("#architecture-boundaries").getByRole("button", { name: "Landing Zone", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".react-flow__node-group")).toHaveCount(1);
  const exportButton = page.getByRole("button", { name: "Export", exact: true });
  await exportButton.focus();
  await page.keyboard.press("Enter");
  await expect(exportButton).toHaveAttribute("aria-expanded", "true");
  for (let index = 0; index < 5; index++) await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /^JSON .+re-importable$/ })).toBeFocused();
  const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await exportButton.click();
  await page.keyboard.press("Escape");
  await expect(exportButton).toHaveAttribute("aria-expanded", "false");
  await expect(exportButton).toBeFocused();
});

test("a nested template handoff retains parent-relative geometry and boundary semantics", async ({ page }) => {
  const icon = manifest.icons.find((candidate) => candidate.cloud === "azure")!;
  const nodes = [
    { id: "template-app", type: "service", parentId: "template-subnet", position: { x: 40, y: 70 }, data: { label: icon.label, iconId: icon.id, cloud: icon.cloud } },
    { id: "template-subnet", type: "group", parentId: "template-vnet", position: { x: 30, y: 70 }, width: 500, height: 280, data: { label: "Apps", variant: "subnet" } },
    { id: "template-vnet", type: "group", parentId: "template-lz", position: { x: 35, y: 70 }, width: 700, height: 450, data: { label: "Network", variant: "vnet" } },
    { id: "template-lz", type: "group", position: { x: 100, y: 50 }, width: 880, height: 620, data: { label: "Production", variant: "landing-zone" } },
  ];
  await page.goto("/");
  await page.evaluate((nodes) => {
    localStorage.setItem("architecture-playground:template-handoff:nested-boundary-test",
      JSON.stringify({ id: "nested-boundary-test", graph: { nodes, edges: [] }, savedAt: new Date().toISOString() }));
  }, nodes);
  await page.goto("/diagrammatic?templateHandoff=nested-boundary-test");
  await waitForWorkspace(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(4, { timeout: 30_000 });
  const graph = await exportGraph(page);
  expect(graph.nodes.map((node) => node.id)).toEqual(["template-lz", "template-vnet", "template-subnet", "template-app"]);
  expect(graph.nodes[0]).toMatchObject({ tier: "Landing Zone", x: 100, y: 50 });
  expect(graph.nodes[1]).toMatchObject({ tier: "Virtual Network", x: 35, y: 70, parentId: "template-lz" });
  expect(graph.nodes[2]).toMatchObject({ tier: "Subnet", x: 30, y: 70, parentId: "template-vnet" });
  expect(graph.nodes[3]).toMatchObject({ iconId: icon.id, iconPath: icon.path, x: 40, y: 70, parentId: "template-subnet" });
});
