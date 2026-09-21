import { expect, test, type Page } from "@playwright/test";
import { readCanvasPayload } from "./read-canvas-payload";
import { waitForWorkspace } from "./wait-for-workspace";

// All imagery in this file is a deterministic browser-drawn fixture, not model
// output. Inspect real Excalidraw canvas pixels, not only stored JSON or CSS.
async function colorsOnCanvas(page: Page, colors: string[]) {
  return page.locator("canvas.excalidraw__canvas.static").evaluate((node, requested) => {
    const canvas = node as HTMLCanvasElement;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const counts = Object.fromEntries(requested.map((color) => [color, 0]));
    const palette = new Map(requested.map((color) => [parseInt(color.slice(1), 16), color]));
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] !== 255) continue;
      const color = palette.get((data[index] << 16) | (data[index + 1] << 8) | data[index + 2]);
      if (color) counts[color]++;
    }
    return { counts, filter: getComputedStyle(canvas).filter };
  }, colors);
}

async function draft(page: Page) {
  const payload = await readCanvasPayload(page, "whiteboard");
  return JSON.parse(JSON.stringify(payload ?? { elements: [], files: {} }));
}

for (const surface of [
  { theme: "dark", backgroundColor: "#05080d", foregroundColor: "#f8fafc" },
  { theme: "light", backgroundColor: "#f8fafc", foregroundColor: "#0f172a" },
  { theme: "dark", backgroundColor: "#fff3bf", foregroundColor: "#0f172a" },
  { theme: "light", backgroundColor: "#193a52", foregroundColor: "#f8fafc" },
] as const) {
  test(`fixture image request, aspect and literal pixels on ${surface.theme} / ${surface.backgroundColor}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript((canvas) => {
      localStorage.clear();
      localStorage.setItem("diagrammatic.canvas-themes", JSON.stringify({ whiteboard: canvas.theme }));
      localStorage.setItem("diagrammatic.draft.whiteboard", JSON.stringify({
        payload: { elements: [], files: {}, appState: { viewBackgroundColor: canvas.backgroundColor } }, savedAt: Date.now(),
      }));
    }, surface);
    await page.route("**/api/ai/status", (route) => route.fulfill({ json: { diagramConfigured: false, imageConfigured: true, imageSource: "local" } }));
    let requestBody: Record<string, unknown> | undefined;
    let fixtureB64 = "";
    await page.route("**/api/ai/image", async (route) => {
      requestBody = route.request().postDataJSON();
      fixtureB64 = await page.evaluate((background) => {
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 160;
        const context = canvas.getContext("2d")!;
        context.fillStyle = background;
        context.fillRect(0, 0, 240, 160);
        context.fillStyle = "#0078d4";
        context.fillRect(50, 50, 60, 60);
        context.fillStyle = "#ffb900";
        context.fillRect(130, 50, 60, 60);
        return canvas.toDataURL("image/png").split(",")[1];
      }, surface.backgroundColor);
      await route.fulfill({
        contentType: "text/event-stream",
        // The nominal request/result size deliberately differs from decoded bytes.
        body: `data: ${JSON.stringify({ type: "result", b64: fixtureB64, size: "1024x1024", canvas: surface })}\n\n`,
      });
    });
    await page.goto("/diagrammatic?mode=whiteboard");
    await waitForWorkspace(page);
    await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    // Draft recovery can choose the mode's default theme. Select the actual
    // surface through the app, rather than assuming a seeded preference won.
    if (surface.theme === "light") {
      const makeLight = page.getByRole("button", { name: "Switch to white canvas" });
      if (await makeLight.isVisible()) await makeLight.click();
      await expect(page.getByRole("button", { name: "Switch to black canvas" })).toBeVisible();
    }
    await page.getByRole("button", { name: "AI Assist" }).click();
    await page.getByLabel("Describe the image to generate").fill("Deterministic fixture, not a live AI request");
    await page.getByLabel("Visual style").selectOption("workshop");
    await page.getByRole("button", { name: "Generate image" }).click();
    await expect(page.getByRole("dialog", { name: "AI Assist" })).toHaveCount(0);
    expect(requestBody?.canvas).toEqual(surface);
    expect(requestBody?.style).toBe("workshop");
    await expect.poll(async () => (await draft(page)).elements.filter((element: { type: string }) => element.type === "image").length).toBe(1);
    const payload = await draft(page);
    const image = payload.elements.find((element: { type: string }) => element.type === "image");
    expect(image.width / image.height).toBe(1.5);
    expect(image.customData.diagrammaticImageCanvas).toEqual(surface);
    expect(payload.files[image.fileId].dataURL).toBe(`data:image/png;base64,${fixtureB64}`);
    await expect.poll(async () => (await colorsOnCanvas(page, ["#0078d4"])).counts["#0078d4"]).toBeGreaterThan(100);
    const pixels = await colorsOnCanvas(page, [surface.backgroundColor, "#0078d4", "#ffb900"]);
    expect(pixels.filter).toBe("none");
    expect(pixels.counts[surface.backgroundColor]).toBeGreaterThan(1000);
    expect(pixels.counts["#ffb900"]).toBeGreaterThan(100);
    if (surface.backgroundColor === "#05080d") {
      await page.locator(".diagrammatic-whiteboard").getByRole("button", { name: "Undo", exact: true }).click();
      await expect.poll(async () => (await draft(page)).elements.filter((element: { type: string; isDeleted?: boolean }) => element.type === "image" && !element.isDeleted).length).toBe(0);
      await page.locator(".diagrammatic-whiteboard").getByRole("button", { name: "Redo", exact: true }).click();
      await expect.poll(async () => (await draft(page)).elements.filter((element: { type: string; isDeleted?: boolean }) => element.type === "image" && !element.isDeleted).length).toBe(1);
      await page.getByRole("button", { name: "Export", exact: true }).click();
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "PNG · high resolution" }).click();
      const stream = await (await downloadPromise).createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
      const exported = await page.evaluate(async (dataURL) => {
        const image = new Image();
        image.src = dataURL;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let blue = 0;
        let background = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] === 0 && pixels[index + 1] === 120 && pixels[index + 2] === 212) blue++;
          if (pixels[index] === 5 && pixels[index + 1] === 8 && pixels[index + 2] === 13) background++;
        }
        return { blue, background };
      }, `data:image/png;base64,${Buffer.concat(chunks).toString("base64")}`);
      expect(exported.blue).toBeGreaterThan(100);
      expect(exported.background).toBeGreaterThan(1000);
    }
  });
}

test("semantic text/symbols adapt, custom colors and multicolor SVG pixels survive themes and reload", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("fidelity-seeded")) return;
    sessionStorage.setItem("fidelity-seeded", "yes");
    localStorage.clear();
    localStorage.setItem("diagrammatic.canvas-themes", JSON.stringify({ whiteboard: "dark" }));
    const base = {
      angle: 0, strokeColor: "#f8fafc", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 3,
      strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null,
      seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: [], updated: 1, link: null, locked: false,
    };
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="80" height="100" fill="#0078d4"/><rect x="80" width="80" height="100" fill="#ffb900"/></svg>';
    localStorage.setItem("diagrammatic.draft.whiteboard", JSON.stringify({
      payload: {
        elements: [
          { ...base, id: "managed-label", type: "text", x: 0, y: 0, width: 250, height: 40, text: "Readable labels", originalText: "Readable labels", fontSize: 28, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null, autoResize: true, lineHeight: 1.25, customData: { diagrammaticForeground: "#f8fafc" } },
          { ...base, id: "custom-color", type: "rectangle", x: 0, y: 80, width: 100, height: 100, strokeColor: "#de1234", backgroundColor: "#de1234" },
          { ...base, id: "literal-svg", type: "image", x: 160, y: 80, width: 160, height: 100, fileId: "brand-fixture", status: "saved", scale: [1, 1], crop: null },
        ],
        files: { "brand-fixture": { id: "brand-fixture", mimeType: "image/svg+xml", dataURL: `data:image/svg+xml;base64,${btoa(svg)}`, created: 1 } },
        appState: { viewBackgroundColor: "#05080d", currentItemStrokeColor: "#f8fafc" },
      },
      savedAt: Date.now(),
    }));
  });
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await colorsOnCanvas(page, ["#0078d4"])).counts["#0078d4"]).toBeGreaterThan(100);
  await page.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill("user");
  await page.getByRole("button", { name: "User", exact: true }).first().click();
  await expect.poll(async () => (await draft(page)).elements.filter((element: { customData?: { diagrammaticSymbol?: unknown } }) => element.customData?.diagrammaticSymbol).length).toBe(1);
  // Excalidraw normalizes imported SVG viewBox/version once on decoding.
  // Theme changes must not subsequently rewrite those normalized binaries.
  const originalFiles = (await draft(page)).files;
  await page.getByRole("button", { name: "Switch to white canvas" }).click();
  await expect.poll(async () => (await draft(page)).elements.find((element: { id: string }) => element.id === "managed-label").strokeColor).toBe("#0f172a");
  const light = await draft(page);
  const symbol = light.elements.find((element: { customData?: { diagrammaticSymbol?: unknown } }) => element.customData?.diagrammaticSymbol);
  expect(Buffer.from(light.files[symbol.fileId].dataURL.split(",")[1], "base64").toString()).toContain("#0f172a");
  expect(light.elements.find((element: { id: string }) => element.id === "custom-color").strokeColor).toBe("#de1234");
  expect(light.files["brand-fixture"]).toEqual(originalFiles["brand-fixture"]);
  await expect.poll(async () => (await colorsOnCanvas(page, ["#0f172a"])).counts["#0f172a"]).toBeGreaterThan(30);
  for (const color of ["#de1234", "#0078d4", "#ffb900"]) {
    expect((await colorsOnCanvas(page, [color])).counts[color]).toBeGreaterThan(100);
  }
  await page.reload();
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await colorsOnCanvas(page, ["#0f172a"])).counts["#0f172a"]).toBeGreaterThan(30);
  expect((await draft(page)).files["brand-fixture"]).toEqual(originalFiles["brand-fixture"]);
});

test("new native text opts into readable foregrounds without disturbing text editing", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("toolbar-text").locator("..").click();
  await page.locator("canvas.excalidraw__canvas.interactive").click({ position: { x: 350, y: 240 } });
  await page.keyboard.type("Customer labels");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await draft(page)).elements.find((element: { type: string; isDeleted?: boolean }) => element.type === "text" && !element.isDeleted)?.text).toBe("Customer labels");
  const darkText = (await draft(page)).elements.find((element: { type: string }) => element.type === "text");
  expect(darkText.customData.diagrammaticForeground).toBe("#f8fafc");
  await page.getByRole("button", { name: "Switch to white canvas" }).click();
  await expect.poll(async () => (await draft(page)).elements.find((element: { type: string }) => element.type === "text")?.strokeColor).toBe("#0f172a");
  await expect.poll(async () => (await colorsOnCanvas(page, ["#0f172a"])).counts["#0f172a"]).toBeGreaterThan(20);
});

test("pre-release untagged bundled Lucide icons remain readable on light canvas without recoloring legacy text", async ({ page, request }) => {
  test.setTimeout(90_000);
  const manifest = await (await request.get("/whiteboard-assets.json")).json();
  const svg = manifest.assets.find((asset: { id: string }) => asset.id === "lucide:user").svg as string;
  expect(svg).toContain('stroke="#0f172a"');
  // d70340c inserted these exact bundled bytes, with no customData. Its dark
  // text default was #f8fafc, indistinguishable from a deliberate custom color.
  await page.addInitScript((svg) => {
    localStorage.clear();
    const base = {
      angle: 0, strokeColor: "#f8fafc", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2,
      strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null,
      seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: [], updated: 1, link: null, locked: false,
    };
    localStorage.setItem("diagrammatic.draft.whiteboard", JSON.stringify({
      payload: {
        elements: [
          { ...base, id: "pre-release-user", type: "image", x: 0, y: 0, width: 180, height: 180, fileId: "symbol-user-legacy", status: "saved", scale: [1, 1], crop: null },
          { ...base, id: "untagged-pale-text", type: "text", x: 220, y: 40, width: 180, height: 25, text: "Legacy chosen color", originalText: "Legacy chosen color", fontSize: 20, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null, autoResize: true, lineHeight: 1.25 },
        ],
        files: { "symbol-user-legacy": { id: "symbol-user-legacy", mimeType: "image/svg+xml", dataURL: `data:image/svg+xml;base64,${btoa(svg)}`, created: 1 } },
        appState: { viewBackgroundColor: "#05080d", currentItemStrokeColor: "#f8fafc" },
      },
      savedAt: Date.now(),
    }));
  }, svg);
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Switch to white canvas" }).click();
  await expect.poll(async () => (await colorsOnCanvas(page, ["#0f172a"])).counts["#0f172a"]).toBeGreaterThan(100);
  const payload = await draft(page);
  expect(payload.elements.find((element: { id: string }) => element.id === "pre-release-user").customData?.diagrammaticSymbol).toBeUndefined();
  expect(payload.elements.find((element: { id: string }) => element.id === "untagged-pale-text").strokeColor).toBe("#f8fafc");
  expect(Buffer.from(payload.files["symbol-user-legacy"].dataURL.split(",")[1], "base64").toString()).toContain('stroke="#0f172a"');
});
