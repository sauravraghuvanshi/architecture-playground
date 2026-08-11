import { expect, test } from "@playwright/test";

test.describe("Curated Whiteboard assets", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

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

  test("searches and inserts a bundled symbol into Excalidraw", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/diagrammatic?mode=whiteboard");
    await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("600 bundled Lucide symbols")).toBeVisible();
    await expect(
      page.getByText("Community libraries remain optional", { exact: false })
    ).toBeVisible();

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
    await page.reload();
    await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    expect(pageErrors.filter((message) => message.includes("Maximum update depth"))).toEqual([]);
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
});
