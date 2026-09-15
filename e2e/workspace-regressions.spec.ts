import { expect, test } from "@playwright/test";

test.describe("Workspace regressions", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test("keeps C4 personas visible during a connection drag", async ({ page }) => {
    await page.goto("/diagrammatic?mode=c4");
    await expect(page.getByRole("tab", { name: "C4 / System" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const nodes = page.locator(".react-flow__node");
    await expect(nodes.first()).toBeVisible({ timeout: 30_000 });

    const source = nodes.first().locator('.react-flow__handle[data-handlepos="bottom"]');
    const target = nodes.last().locator('.react-flow__handle[data-handlepos="top"]');
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("C4 connection handles are unavailable");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      (sourceBox.x + targetBox.x) / 2,
      (sourceBox.y + targetBox.y) / 2,
      { steps: 12 }
    );
    await page.waitForSelector(".react-flow__connectionline", { state: "attached" });

    const heldState = await page.evaluate(() => {
      const layer = document.querySelector<SVGElement>(".react-flow__connectionline");
      return {
        background: layer ? getComputedStyle(layer).backgroundColor : null,
        nodes: Array.from(document.querySelectorAll<HTMLElement>(".react-flow__node")).map(
          (node) => {
            const rect = node.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              opacity: Number(getComputedStyle(node).opacity),
            };
          }
        ),
      };
    });
    expect(heldState.background).toBe("rgba(0, 0, 0, 0)");
    for (const node of heldState.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
      expect(node.opacity).toBeGreaterThan(0.9);
    }

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
  });

  const structuredModes = [
    { mode: "architecture", label: "Cloud Architecture" },
    { mode: "flowchart", label: "Flowchart" },
    { mode: "mindmap", label: "Mind Map" },
    { mode: "sequence", label: "Sequence Diagram" },
    { mode: "er", label: "ER Diagram" },
    { mode: "uml", label: "UML" },
    { mode: "c4", label: "C4 / System" },
  ] as const;

  for (const check of structuredModes) {
    test(`${check.label} can start with a blank canvas`, async ({ page }) => {
      await page.goto(`/diagrammatic?mode=${check.mode}`);
      await expect(page.getByRole("tab", { name: check.label })).toHaveAttribute(
        "aria-selected",
        "true"
      );

      if (check.mode === "architecture") {
        await page.getByRole("button", { name: "Component", exact: true }).click();
      }
      await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });

      await page.getByRole("button", { name: "New diagram", exact: true }).click();
      await expect(page.locator(".react-flow__node")).toHaveCount(0);
    });
  }

  test("Kanban can start with a blank board", async ({ page }) => {
    await page.goto("/diagrammatic?mode=kanban");
    await expect(page.getByText("Onboarding flow")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "New diagram", exact: true }).click();

    await expect(page.getByText("Onboarding flow")).toHaveCount(0);
    await expect(page.getByText("Backlog", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("In progress", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Done", { exact: false }).first()).toBeVisible();
  });

  test("Whiteboard exposes the blank canvas action", async ({ page }) => {
    await page.goto("/diagrammatic?mode=whiteboard");
    await expect(page.getByRole("tab", { name: "Whiteboard" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "New diagram", exact: true }).click();
    await expect(page.locator(".excalidraw").first()).toBeVisible();
  });
});
