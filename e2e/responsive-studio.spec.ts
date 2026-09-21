import { expect, test } from "@playwright/test";
import { readCanvasPayload } from "./read-canvas-payload";
import { waitForWorkspace } from "./wait-for-workspace";

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  for (const mode of ["architecture", "whiteboard"] as const) {
    test(`${mode} keeps a usable canvas and accessible drawers at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/diagrammatic?mode=${mode}`);
      await waitForWorkspace(page);
      if (mode === "whiteboard") await expect(page.locator(".excalidraw").first()).toBeVisible();
      const surface = page.locator(".diagrammatic-canvas-surface");
      const bounds = await surface.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(viewport.width - 8);
      expect(bounds?.height).toBeGreaterThanOrEqual(Math.min(160, viewport.height * 0.4));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      const trigger = page.getByRole("button", { name: mode === "whiteboard" ? "Open Whiteboard assets" : "Open architecture components", exact: true });
      await trigger.click();
      const drawer = page.getByRole("dialog", { name: mode === "whiteboard" ? "Whiteboard assets" : "Architecture components", exact: true });
      await expect(drawer).toBeVisible();
      expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      const drawerBounds = await drawer.boundingBox();
      expect(drawerBounds!.x).toBeGreaterThanOrEqual(0);
      expect(drawerBounds!.x + drawerBounds!.width).toBeLessThanOrEqual(viewport.width);
      if (mode === "whiteboard") {
        await drawer.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill("user");
        await drawer.getByRole("button", { name: "User", exact: true }).first().click();
        await expect(drawer).toHaveCount(0);
        await expect.poll(async () => {
          const payload = await readCanvasPayload(page, "whiteboard") as { elements?: Array<{ type: string }> } | undefined;
          return payload?.elements?.filter((element) => element.type === "image").length;
        }).toBe(1);
      } else {
        await drawer.getByRole("button", { name: "Component", exact: true }).click();
        await expect(drawer).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(page.locator(".react-flow__node")).toHaveCount(1);
        await page.locator(".react-flow__node").click();
        const propertiesTrigger = page.getByRole("button", { name: "Open architecture properties", exact: true });
        await propertiesTrigger.click();
        const properties = page.getByRole("dialog", { name: "Architecture properties", exact: true });
        await properties.getByLabel("Display name", { exact: true }).fill("Narrow-screen service");
        await properties.getByLabel("Display name", { exact: true }).press("Enter");
        await page.keyboard.press("Escape");
        await expect(properties).toHaveCount(0);
        await expect(propertiesTrigger).toBeFocused();
        await expect(page.locator(".react-flow__node")).toContainText("Narrow-screen service");
        await page.keyboard.press("Control+z");
        await expect(page.locator(".react-flow__node")).toContainText("Component");
        await propertiesTrigger.click();
        await expect(properties.getByLabel("Display name", { exact: true })).toHaveValue("Component");
        await page.keyboard.press("Escape");
      }
      if (mode === "whiteboard") await expect(trigger).toBeFocused();
    });
  }
}

test("desktop keeps inline panels while boundary and export disclosures support keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await expect(page.getByRole("button", { name: "Open architecture components", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Component", exact: true })).toBeVisible();
  const boundary = page.getByRole("button", { name: "Boundary / Tier", exact: true });
  await boundary.focus();
  await boundary.press("ArrowDown");
  const boundaries = page.getByRole("group", { name: "Architecture boundaries", exact: true });
  await expect(boundaries.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(boundaries.getByRole("button").last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(boundaries.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(boundaries).toHaveCount(0);
  await expect(boundary).toBeFocused();
  const exports = page.getByRole("button", { name: "Export", exact: true });
  await exports.focus();
  await exports.press("ArrowUp");
  const formats = page.getByRole("group", { name: "Export formats", exact: true });
  await expect(formats.getByRole("button").last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(formats.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(formats).toHaveCount(0);
  await expect(exports).toBeFocused();
});

test("workspace mode tabs support roving keyboard focus without switching before activation", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  const tabs = page.getByRole("tablist", { name: "Workspace modes" });
  const architecture = tabs.getByRole("tab", { name: "Cloud Architecture", exact: true });
  await architecture.focus();
  await page.keyboard.press("ArrowRight");
  const flowchart = tabs.getByRole("tab", { name: "Flowchart", exact: true });
  await expect(flowchart).toBeFocused();
  await expect(architecture).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(flowchart).toHaveAttribute("aria-selected", "true");
  await expect(flowchart).toBeFocused();
  await expect(flowchart).toHaveAttribute("tabindex", "0");
  await expect(architecture).toHaveAttribute("tabindex", "-1");
});

test("legacy export help commands and context actions keep keyboard focus within their surfaces", async ({ page }) => {
  await page.goto("/legacy-playground");
  const format = page.getByLabel("Export format", { exact: true });
  await format.focus();
  await format.selectOption("iac");
  const iac = page.getByRole("dialog", { name: "Export as IaC", exact: true });
  await expect(iac).toBeVisible();
  await expect.poll(() => iac.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    expect(await iac.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(iac).toHaveCount(0);
  await expect(format).toBeFocused();
  const shortcuts = page.getByRole("button", { name: "Keyboard shortcuts (?)", exact: true });
  await shortcuts.focus();
  await page.keyboard.press("Space");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true });
  await expect(help).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(await help.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  await expect(shortcuts).toBeFocused();
  await page.keyboard.press("Control+k");
  const commands = page.getByRole("dialog", { name: "Command palette", exact: true });
  await expect(commands.getByLabel("Search commands", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(commands).toHaveCount(0);
  await expect(shortcuts).toBeFocused();
  await page.locator(".react-flow__pane").click({ button: "right", position: { x: 250, y: 180 } });
  const actions = page.getByRole("group", { name: "Canvas actions", exact: true });
  await expect(actions.getByRole("button", { name: "Add note here", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(actions.getByRole("button", { name: /^Fit view/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(actions).toHaveCount(0);
  const canvas = page.getByRole("region", { name: "Architecture canvas", exact: true });
  await canvas.focus();
  await page.keyboard.press("Shift+F10");
  await expect(actions.getByRole("button", { name: "Add note here", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(canvas).toBeFocused();
});

test("opening the library after saving a dirty draft still restores the invoking control", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await page.getByRole("button", { name: "Component", exact: true }).click();
  const opener = page.getByRole("button", { name: "My diagrams", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Saved diagrams", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close diagram library", exact: true })).toBeEnabled();
  await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
