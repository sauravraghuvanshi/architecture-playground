import { expect, test } from "@playwright/test";
import { readCanvasPayload } from "./read-canvas-payload";

test("connects bundled symbols with a flow arrow and exports an animated GIF", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/diagrammatic?mode=whiteboard");

  const whiteboard = page.locator(".diagrammatic-whiteboard");
  await expect(whiteboard.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
  const search = page.getByRole("searchbox", { name: "Search Whiteboard assets" });

  await search.fill("user");
  await page
    .getByRole("button", { name: "User", exact: true })
    .first()
    .dragTo(whiteboard, { targetPosition: { x: 340, y: 300 } });

  await search.fill("server");
  await page
    .getByRole("button", { name: "Server", exact: true })
    .first()
    .dragTo(whiteboard, { targetPosition: { x: 760, y: 300 } });

  await page.getByRole("button", { name: "Activate Whiteboard flow arrow" }).click();
  await expect(page.getByText("Flow arrow active", { exact: false })).toBeVisible();

  const bounds = await whiteboard.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 430, bounds!.y + 300);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 670, bounds!.y + 300, { steps: 12 });
  await page.mouse.up();

  const arrowState = async () => {
    const payload = await readCanvasPayload(page, "whiteboard") as {
      elements?: Array<{
        type?: string;
        isDeleted?: boolean;
        width?: number;
        height?: number;
        startBinding?: { elementId?: string };
        endBinding?: { elementId?: string };
      }>;
    };
    return (payload?.elements ?? []).filter((element) => element.type === "arrow" && !element.isDeleted).map((element) => ({
      longEnough: Math.hypot(element.width ?? 0, element.height ?? 0) > 100,
      startBound: Boolean(element.startBinding?.elementId),
      endBound: Boolean(element.endBinding?.elementId),
      distinctSymbols: element.startBinding?.elementId !== element.endBinding?.elementId,
    }));
  };
  const connectedArrow = [{ longEnough: true, startBound: true, endBound: true, distinctSymbols: true }];
  await expect.poll(arrowState, { timeout: 15_000 }).toEqual(connectedArrow);
  await whiteboard.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(arrowState).toEqual([]);
  await whiteboard.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(arrowState).toEqual(connectedArrow);

  await page.getByRole("button", { name: "Export" }).click();
  const gifOption = page.getByRole("button", { name: "GIF · ordered request flow" });
  await expect(gifOption).toBeVisible();
  const capture = page.evaluate(
    () =>
      new Promise<{ frameCount: number; arrowCount: number }>((resolve) => {
        window.addEventListener(
          "diagrammatic-whiteboard-gif-capture",
          (event) =>
            resolve(
              (event as CustomEvent<{ frameCount: number; arrowCount: number }>).detail
            ),
          { once: true }
        );
      })
  );
  const downloadPromise = page.waitForEvent("download");
  await gifOption.click();
  const [download, captureDetail] = await Promise.all([downloadPromise, capture]);

  expect(download.suggestedFilename()).toMatch(/^whiteboard-.*\.gif$/);
  expect(captureDetail.arrowCount).toBe(1);
  expect(captureDetail.frameCount).toBeGreaterThanOrEqual(5);
  await expect(page.getByRole("status")).toContainText("GIF export downloaded");
});
