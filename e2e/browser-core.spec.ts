import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import manifest from "../content/cloud-icons.json";
import { readCanvasPayload } from "./read-canvas-payload";
import { waitForWorkspace } from "./wait-for-workspace";

test("cold and cached prompt documents cannot be overwritten by an older canvas notification", async ({ page }) => {
  for (const prompt of [
    "Azure App Service with Azure SQL Database",
    "Azure Functions with Cosmos DB",
    "Azure App Service with Azure SQL Database",
  ]) {
    await page.goto(`/diagrammatic?prompt=${encodeURIComponent(prompt)}`);
    await waitForWorkspace(page);
    await expect(page.locator(".react-flow__node-icon")).toHaveCount(2);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator(".react-flow__node-icon")).toHaveCount(2);
    await expect.poll(async () => {
      const payload = await readCanvasPayload(page, "architecture") as { nodes?: Array<{ kind: string }> } | undefined;
      return payload?.nodes?.filter((node) => node.kind === "icon").length;
    }).toBe(2);
  }
});

test("native palette drags preserve primitive and official service identity across reload", async ({ page }) => {
  const appService = manifest.icons.find((icon) => icon.id === "azure/application/application-service");
  if (!appService) throw new Error("Missing canonical App Service fixture");
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  const canvas = page.locator(".react-flow");
  await page.getByRole("button", { name: "Component", exact: true }).dragTo(canvas, { targetPosition: { x: 180, y: 200 } });
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByLabel("Search cloud services").fill("Azure App Service");
  await page.getByRole("button", { name: appService.label, exact: true }).dragTo(canvas, { targetPosition: { x: 460, y: 200 } });
  await expect(page.locator(".react-flow__node-icon")).toHaveCount(1);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.reload();
  await waitForWorkspace(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  const payload = await readCanvasPayload(page, "architecture") as { nodes: Array<{ iconId?: string; shape?: string }> };
  expect(payload.nodes.some((node) => node.iconId === appService.id)).toBe(true);
  expect(payload.nodes.some((node) => node.shape === "rectangle")).toBe(true);
});

test("downloaded SVG embeds fonts and keeps the visible graph without editor handles", async ({ page }) => {
  await page.goto(`/diagrammatic?prompt=${encodeURIComponent("Azure App Service with Azure SQL Database")}`);
  await waitForWorkspace(page);
  await expect(page.locator(".react-flow__node-icon")).toHaveCount(2);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG · editable vector", exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path();
  if (!file) throw new Error("SVG download unavailable");
  const svg = await readFile(file, "utf8");
  const contents = await page.evaluate((svg) => {
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    return {
      valid: !document.querySelector("parsererror"),
      fonts: svg.includes("@font-face") && /data:(?:font\/[^;]+|application\/(?:octet-stream|font-woff));base64,/.test(svg),
      services: document.querySelectorAll(".react-flow__node-icon").length,
      paths: document.querySelectorAll(".react-flow__edge-path").length,
      handles: document.querySelectorAll(".react-flow__handle").length,
      labels: document.documentElement.textContent?.includes("SQL"),
    };
  }, svg);
  expect(contents).toMatchObject({ valid: true, fonts: true, services: 2, handles: 0, labels: true });
  expect(contents.paths).toBeGreaterThan(0);
});
