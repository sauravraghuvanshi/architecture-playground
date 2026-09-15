import { expect, test } from "@playwright/test";

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";

test.describe("Whiteboard AI", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test("reports independent image and diagram configuration", async ({
    request,
    page,
  }) => {
    const statusResponse = await request.get("/api/ai/status");
    expect(statusResponse.ok()).toBe(true);
    const status = (await statusResponse.json()) as {
      diagramConfigured: boolean;
      imageConfigured: boolean;
      imageSource: string | null;
    };
    expect(typeof status.diagramConfigured).toBe("boolean");
    expect(typeof status.imageConfigured).toBe("boolean");
    expect(["local", "development-proxy", null]).toContain(status.imageSource);

    await page.goto("/diagrammatic?mode=whiteboard");
    if (status.imageConfigured) await expect(page.getByRole("button", { name: "AI Assist" })).toBeEnabled();
    else await expect(page.getByRole("button", { name: "AI Assist" })).toBeDisabled();

    await page.goto("/diagrammatic?mode=c4");
    if (status.diagramConfigured) await expect(page.getByRole("button", { name: "AI Assist" })).toBeEnabled();
    else await expect(page.getByRole("button", { name: "AI Assist" })).toBeDisabled();
  });

  test("generates and inserts an AI image into the Whiteboard", async ({ page }) => {
    await page.route("**/api/ai/status", (route) => route.fulfill({
      json: { diagramConfigured: false, imageConfigured: true, imageSource: "local" },
    }));
    await page.route("**/api/ai/image", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body:
          `data: ${JSON.stringify({ type: "started", elapsed: 0 })}\n\n` +
          `data: ${JSON.stringify({
            type: "result",
            b64: ONE_PIXEL_PNG,
            size: "1024x1024",
            elapsed: 1,
          })}\n\n`,
      });
    });

    await page.goto("/diagrammatic?mode=whiteboard");
    await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "AI Assist" }).click();
    await expect(page.getByRole("dialog", { name: "AI Assist" })).toBeVisible();
    await page.locator('textarea[placeholder*="hand-drawn diagram"]').fill(
      "A friendly robot architect holding a blueprint"
    );
    await page.getByRole("button", { name: "Generate image" }).click();
    await expect(page.getByRole("dialog", { name: "AI Assist" })).toHaveCount(0);

    await page.waitForFunction(() => {
      const raw = localStorage.getItem("diagrammatic.draft.whiteboard");
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { payload?: { elements?: Array<{ type?: string }> } };
      return parsed.payload?.elements?.some((element) => element.type === "image") ?? false;
    });
  });
});
