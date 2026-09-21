import { expect, test } from "@playwright/test";
import { readCanvasPayload } from "./read-canvas-payload";
import { assertCanvasErrors } from "./assert-canvas-errors";

test.describe("Curated Whiteboard assets", () => {
  test("ships 600 unique ISC-licensed symbols", async ({ request }) => {
    const response = await request.get("/whiteboard-assets.json");
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      count: number;
      license: string;
      assets: Array<{ id: string; svg: string }>;
    };
    expect(manifest.count).toBe(600);
    expect(manifest.license).toBe("ISC");
    expect(manifest.assets).toHaveLength(600);
    expect(new Set(manifest.assets.map((asset) => asset.id)).size).toBe(600);
    expect(manifest.assets.every((asset) => asset.svg.startsWith("<svg"))).toBe(true);
  });

  test("searches and inserts a bundled symbol into Whiteboard", async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/diagrammatic?mode=whiteboard");
    await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("600 bundled Lucide symbols")).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Search Whiteboard assets" });
    await search.fill("user");
    const userAsset = page.getByRole("button", { name: "User", exact: true }).first();
    await expect(userAsset).toBeVisible();
    await userAsset.click();

    await page.waitForFunction(() => {
      const raw = localStorage.getItem("diagrammatic.draft.whiteboard");
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { payload?: { elements?: Array<{ type?: string }> } };
      return parsed.payload?.elements?.some((element) => element.type === "image") ?? false;
    });
    const before = await readCanvasPayload(page, "whiteboard") as { elements: Array<{ type: string; fileId?: string }>; files: Record<string, { dataURL: string }> };
    const image = before.elements.find((element) => element.type === "image");
    if (!image?.fileId) throw new Error("Inserted image is missing");
    const bytes = before.files[image.fileId].dataURL;
    await page.reload();
    await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => {
      const restored = await readCanvasPayload(page, "whiteboard") as typeof before | undefined;
      const restoredImage = restored?.elements.find((element) => element.type === "image");
      return restoredImage?.fileId ? restored?.files[restoredImage.fileId]?.dataURL : undefined;
    }).toBe(bytes);
    await assertCanvasErrors(page, pageErrors);
  });

  test("sanitizes legacy persisted UI state without a render loop", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "diagrammatic.draft.whiteboard",
        JSON.stringify({
          payload: {
            elements: [],
            files: {},
            appState: {
              viewBackgroundColor: "#f8fafc",
              collaborators: {},
              openMenu: "canvasBackground",
              openSidebar: { name: "library" },
              selectedElementIds: { stale: true },
              activeTool: { type: "selection" },
            },
          },
          savedAt: Date.now(),
        })
      );
    });

    const workspace = await page.context().newPage();
    const errors: string[] = [];
    workspace.on("pageerror", (error) => errors.push(error.message));
    await workspace.goto("/diagrammatic?mode=whiteboard");
    await expect(workspace.locator(".excalidraw").first()).toBeVisible({
      timeout: 30_000,
    });
    await workspace.waitForTimeout(1000);
    expect(errors.filter((message) => message.includes("Maximum update depth"))).toEqual([]);
    await workspace.close();
  });

  test("drags a bundled symbol onto the Whiteboard", async ({ page }) => {
    await page.goto("/diagrammatic?mode=whiteboard");
    await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("searchbox", { name: "Search Whiteboard assets" }).fill("user");
    const asset = page.getByRole("button", { name: "User", exact: true }).first();
    await expect(asset).toHaveAttribute("draggable", "true");
    await asset.dragTo(page.locator(".diagrammatic-whiteboard"));

    await page.waitForFunction(() => {
      const raw = localStorage.getItem("diagrammatic.draft.whiteboard");
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { payload?: { elements?: Array<{ type?: string }> } };
      return parsed.payload?.elements?.some((element) => element.type === "image") ?? false;
    });
  });

  test("removes upstream help, library, and scene import surfaces", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(
      "/diagrammatic?mode=whiteboard#addLibrary=https%3A%2F%2Fexample.com%2Fsample.excalidrawlib&token=external"
    );
    const whiteboard = page.locator(".diagrammatic-whiteboard");
    await expect(whiteboard.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });

    await expect(page).not.toHaveURL(/addLibrary|token=external/);
    await expect(whiteboard).not.toContainText("Excalidraw");
    await expect(whiteboard.getByRole("checkbox", { name: "Library" })).toBeHidden();
    await expect(whiteboard.getByRole("button", { name: "Help" })).toBeHidden();
    await expect(
      whiteboard.locator('input[type="file"][accept*=".excalidraw"]')
    ).toHaveCount(0);

    await whiteboard.locator('[data-testid="main-menu-trigger"]').click();
    await expect(page.getByText("Import library from URL", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Browse public libraries", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Help", { exact: true })).toHaveCount(0);
    await expect(
      whiteboard.locator(
        'a[href*="excalidraw"], a[href*="github.com/excalidraw"], a[href*="youtube"]'
      )
    ).toHaveCount(0);

    await whiteboard.click({ position: { x: 600, y: 400 } });
    const fileChooserOpened = page
      .waitForEvent("filechooser", { timeout: 750 })
      .then(() => true)
      .catch(() => false);
    await page.keyboard.press("Control+O");
    expect(await fileChooserOpened).toBe(false);

    await page.keyboard.press("0");
    await expect(whiteboard.getByText("Library", { exact: true })).toBeHidden();

    const hiddenLibraryControl = whiteboard.getByRole("checkbox", { name: "Library" });
    if ((await hiddenLibraryControl.count()) > 0) {
      await hiddenLibraryControl.evaluate((element) => (element as HTMLInputElement).click());
    }
    await expect(whiteboard.locator(".default-sidebar")).toBeHidden();
    await expect(page.getByText("Browse libraries", { exact: false })).toBeHidden();
  });
});
