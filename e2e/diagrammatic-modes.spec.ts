/**
 * Smoke test for the multi-mode Diagrammatic workspace.
 *
 * For each non-architecture mode this verifies:
 *  - the mode tab activates
 *  - the canvas mounts with its default content (a node / element / column)
 *  - working canvas controls remain available without duplicate template menus
 */
import { test, expect, type Page } from "@playwright/test";

interface ModeCheck {
  mode: string;
  /** Visible label of the tab button (matches MODE_META.label). */
  label: RegExp;
  /** A locator that should resolve once the mode's canvas mounts. */
  canvasReady: (page: Page) => ReturnType<Page["locator"]>;
}

const CHECKS: ModeCheck[] = [
  {
    mode: "flowchart",
    label: /^Flowchart$/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
  },
  {
    mode: "mindmap",
    label: /^Mind Map$/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
  },
  {
    mode: "sequence",
    label: /Sequence Diagram/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
  },
  {
    mode: "er",
    label: /ER Diagram/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
  },
  {
    mode: "uml",
    label: /^UML$/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
  },
  {
    mode: "c4",
    label: /C4 \/ System/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
  },
  {
    mode: "kanban",
    label: /Kanban Board/,
    // Kanban renders dnd-kit columns — match the default "Backlog" column.
    canvasReady: (p) => p.getByText(/Backlog|New$/).first(),
  },
];

test.describe("Diagrammatic — mode workspace smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/diagrammatic");
    // Workspace is client-only; wait for the mode tab strip to render.
    await expect(page.getByRole("tab", { name: /Cloud Architecture/ })).toBeVisible();
  });

  for (const c of CHECKS) {
    test(`mode "${c.mode}" mounts with supported controls`, async ({ page }) => {
      // Switch to mode.
      await page.getByRole("tab", { name: c.label }).first().click();

      // Canvas mounts (with its default payload).
      await expect(c.canvasReady(page)).toBeVisible({ timeout: 15_000 });

      await expect(page.getByRole("button", { name: "Templates", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "New diagram", exact: true })).toBeVisible();
    });
  }
});
