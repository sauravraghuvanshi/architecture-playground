/**
 * Smoke test for the multi-mode Diagrammatic workspace.
 *
 * For each non-architecture mode this verifies:
 *  - the mode tab activates
 *  - the canvas mounts with its default content (a node / element / column)
 *  - the Templates dropdown lists the expected starter set and applying a
 *    template changes the visible content
 *
 * This is the Phase 3/4 acceptance net from task/implementation.md.
 */
import { test, expect, type Page } from "@playwright/test";

interface ModeCheck {
  mode: string;
  /** Visible label of the tab button (matches MODE_META.label). */
  label: RegExp;
  /** A locator that should resolve once the mode's canvas mounts. */
  canvasReady: (page: Page) => ReturnType<Page["locator"]>;
  /** Minimum number of templates we expect this mode to ship with. */
  minTemplates: number;
  /** Name of one template (matches templates.ts) we will apply. */
  applyTemplate: string;
  /** Substring expected on the canvas after applying the template. */
  expectAfterApply: RegExp;
}

const CHECKS: ModeCheck[] = [
  {
    mode: "flowchart",
    label: /^Flowchart$/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
    minTemplates: 3,
    applyTemplate: "CI/CD pipeline",
    expectAfterApply: /Push to main/i,
  },
  {
    mode: "mindmap",
    label: /^Mind Map$/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
    minTemplates: 3,
    applyTemplate: "Quarterly OKRs",
    expectAfterApply: /Q3 OKRs/i,
  },
  {
    mode: "sequence",
    label: /Sequence Diagram/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
    minTemplates: 3,
    applyTemplate: "OAuth 2 (PKCE)",
    expectAfterApply: /Identity Provider/i,
  },
  {
    mode: "er",
    label: /ER Diagram/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
    minTemplates: 2,
    applyTemplate: "SaaS multi-tenant",
    expectAfterApply: /Org/,
  },
  {
    mode: "uml",
    label: /^UML$/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
    minTemplates: 2,
    applyTemplate: "Auth system",
    expectAfterApply: /Session/,
  },
  {
    mode: "c4",
    label: /C4 \/ System/,
    canvasReady: (p) => p.locator(".react-flow__node").first(),
    minTemplates: 2,
    applyTemplate: "Mobile banking",
    expectAfterApply: /Mobile App/i,
  },
  {
    mode: "kanban",
    label: /Kanban Board/,
    // Kanban renders dnd-kit columns — match the default "Backlog" column.
    canvasReady: (p) => p.getByText(/Backlog|New$/).first(),
    minTemplates: 2,
    applyTemplate: "Bug triage",
    expectAfterApply: /Triage/,
  },
];

test.describe("Diagrammatic — mode workspace smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/diagrammatic");
    // Workspace is client-only; wait for the mode tab strip to render.
    await expect(page.getByRole("button", { name: /Cloud Architecture/ })).toBeVisible();
  });

  for (const c of CHECKS) {
    test(`mode "${c.mode}" mounts and applies a template`, async ({ page }) => {
      // Switch to mode.
      await page.getByRole("button", { name: c.label }).first().click();

      // Canvas mounts (with its default payload).
      await expect(c.canvasReady(page)).toBeVisible({ timeout: 15_000 });

      // Templates dropdown opens and contains ≥ minTemplates entries.
      const tplBtn = page.getByRole("button", { name: /Templates/i });
      await tplBtn.click();
      // Each template button has the template name as text. Count them
      // by looking for distinct buttons under the dropdown.
      // The dropdown menu uses a panel directly under the button; we count
      // descendants whose first child is a font-semibold name span.
      const tplItems = page.locator("button > span.font-semibold");
      await expect(tplItems.first()).toBeVisible();
      const count = await tplItems.count();
      expect(count).toBeGreaterThanOrEqual(c.minTemplates);

      // Apply the named template.
      await page.getByText(c.applyTemplate, { exact: false }).first().click();

      // The canvas should now reflect the new content.
      await expect(page.getByText(c.expectAfterApply).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});
