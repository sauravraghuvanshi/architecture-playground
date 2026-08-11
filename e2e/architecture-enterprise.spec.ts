import { expect, test, type Page } from "@playwright/test";

async function openAzureBlueprint(page: Page) {
  await page.goto("/diagrammatic");
  await expect(page.getByRole("tab", { name: "Cloud Architecture" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Azure secure web platform/ })).toBeVisible();
  await page.getByRole("button", { name: /Azure secure web platform/ }).click();
  await expect(page.locator(".react-flow__node-icon").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No issues detected.")).toBeVisible();
}

test.describe("Enterprise architecture studio", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test("loads a review-ready blueprint with cloud assets and generic primitives", async ({ page }) => {
    await openAzureBlueprint(page);

    await expect(page.getByRole("heading", { name: "Cloud & primitives" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Azure1130" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AWS258" })).toBeVisible();
    await expect(page.getByRole("button", { name: "GCP45" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Component" })).toBeVisible();

    expect(await page.locator(".react-flow__node-icon").count()).toBeGreaterThanOrEqual(7);
    expect(await page.locator(".react-flow__node-group").count()).toBeGreaterThanOrEqual(5);
    expect(await page.locator(".react-flow__edge").count()).toBeGreaterThanOrEqual(6);
  });

  test("connects from any side and gives each arrow explicit GIF order", async ({ page }) => {
    await openAzureBlueprint(page);

    const nodes = page.locator(".react-flow__node-icon");
    const source = nodes.first().locator('.react-flow__handle[data-handlepos="bottom"]');
    const target = nodes.last().locator('.react-flow__handle[data-handlepos="top"]');
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Connection handles are unavailable");

    const edgeCount = await page.locator(".react-flow__edge").count();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 15,
    });
    const heldDragState = await page.evaluate(() => {
      const connectionLayer = document.querySelector<SVGElement>(".react-flow__connectionline");
      const serviceNodes = Array.from(
        document.querySelectorAll<HTMLElement>(".react-flow__node-icon")
      );
      return {
        connectionBackground: connectionLayer
          ? getComputedStyle(connectionLayer).backgroundColor
          : null,
        nodes: serviceNodes.map((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            width: rect.width,
            height: rect.height,
            opacity: Number(style.opacity),
            visibility: style.visibility,
          };
        }),
      };
    });
    expect(heldDragState.connectionBackground).toBe("rgba(0, 0, 0, 0)");
    expect(heldDragState.nodes).toHaveLength(await nodes.count());
    for (const node of heldDragState.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
      expect(node.opacity).toBeGreaterThan(0.9);
      expect(node.visibility).toBe("visible");
    }
    await page.mouse.up();
    await expect(page.locator(".react-flow__edge")).toHaveCount(edgeCount + 1);

    const newestOrder = edgeCount + 1;
    await page.getByRole("button", { name: `Select connection ${newestOrder} HTTPS` }).click();
    const orderInput = page.locator('input[type="number"]');
    await expect(orderInput).toHaveValue(String(newestOrder));
    await orderInput.fill("99");
    await orderInput.blur();
    await expect(page.getByRole("button", { name: "Select connection 99 HTTPS" })).toBeVisible();

    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
    await page.waitForTimeout(200);
    const animationState = await page.locator(".react-flow__edge-path").evaluateAll((paths) =>
      paths.map((path) => ({
        animation: getComputedStyle(path).animationName,
        opacity: Number(getComputedStyle(path).opacity),
      }))
    );
    expect(animationState.filter((edge) => edge.animation !== "none")).toHaveLength(1);
    expect(animationState.filter((edge) => edge.opacity < 0.5)).toHaveLength(edgeCount);
  });

  test("deleting a boundary removes child services and their connections", async ({ page }) => {
    await openAzureBlueprint(page);
    const iconsBefore = await page.locator(".react-flow__node-icon").count();
    const edgesBefore = await page.locator(".react-flow__edge").count();

    await page.locator(".react-flow__node-group").first().click();
    await page.getByRole("button", { name: "Delete selection (Del)" }).click();

    await expect(page.locator(".react-flow__node-icon")).toHaveCount(iconsBefore - 2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(edgesBefore - 2);
  });

  test("same-step arrows animate together while service cards stay static", async ({ page }) => {
    await openAzureBlueprint(page);
    await page.getByRole("button", { name: "Select connection 2 HTTPS" }).click();
    const orderInput = page.locator('input[type="number"]');
    await orderInput.fill("1");
    await orderInput.blur();
    await expect(page.getByRole("button", { name: "Select connection 1 HTTPS" })).toHaveCount(2);

    await page.getByRole("button", { name: "Play" }).click();
    await page.waitForTimeout(200);
    const playback = await page.evaluate(() => ({
      animatedEdges: Array.from(
        document.querySelectorAll<SVGPathElement>(".react-flow__edge-path")
      ).filter((path) => getComputedStyle(path).animationName !== "none").length,
      serviceTransforms: Array.from(
        document.querySelectorAll<HTMLElement>(".react-flow__node-icon > div")
      ).map((card) => getComputedStyle(card).transform),
    }));
    expect(playback.animatedEdges).toBe(2);
    expect(playback.serviceTransforms.every((transform) => transform === "none")).toBe(true);
  });

  test("produces PNG, PDF, and ordered GIF artifacts", async ({ page }) => {
    test.setTimeout(120_000);
    await openAzureBlueprint(page);
    await page.evaluate(() => {
      const events: Array<{ filename: string; mime: string; size: number }> = [];
      (globalThis as typeof globalThis & { __exportEvents?: typeof events }).__exportEvents = events;
      (
        globalThis as typeof globalThis & {
          __gifCapture?: { frameCount: number; motionFramesPerStep: number };
        }
      ).__gifCapture = undefined;
      window.addEventListener("diagrammatic-export-ready", ((event: CustomEvent) => {
        events.push(event.detail);
      }) as EventListener);
      window.addEventListener("diagrammatic-gif-capture", ((event: CustomEvent) => {
        (
          globalThis as typeof globalThis & {
            __gifCapture?: { frameCount: number; motionFramesPerStep: number };
          }
        ).__gifCapture = event.detail;
      }) as EventListener);
    });

    const exportFormat = async (
      buttonName: RegExp,
      extension: string,
      timeout = 45_000
    ) => {
      await page.getByRole("button", { name: "Export" }).click();
      await page.getByRole("button", { name: buttonName }).click();
      await page.waitForFunction(
        (ext) =>
          (
            globalThis as typeof globalThis & {
              __exportEvents?: Array<{ filename: string; mime: string; size: number }>;
            }
          ).__exportEvents?.some((event) => event.filename.endsWith(ext)),
        extension,
        { timeout }
      );
    };

    await exportFormat(/PNG · high resolution/, ".png");
    await exportFormat(/PDF · presentation ready/, ".pdf");
    await exportFormat(/GIF · ordered request flow/, ".gif", 90_000);

    const events = await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __exportEvents?: Array<{ filename: string; mime: string; size: number }>;
          }
        ).__exportEvents ?? []
    );
    expect(events.find((event) => event.filename.endsWith(".png"))).toMatchObject({
      mime: "image/png",
    });
    expect(events.find((event) => event.filename.endsWith(".pdf"))).toMatchObject({
      mime: "application/pdf",
    });
    expect(events.find((event) => event.filename.endsWith(".gif"))).toMatchObject({
      mime: "image/gif",
    });
    for (const event of events) expect(event.size).toBeGreaterThan(10_000);
    const capture = await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __gifCapture?: { frameCount: number; motionFramesPerStep: number };
          }
        ).__gifCapture
    );
    expect(capture).toEqual({ frameCount: 44, motionFramesPerStep: 6 });
  });
});
