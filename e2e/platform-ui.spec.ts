import { expect, test } from "@playwright/test";
import { CAPABILITIES, TOOLS } from "../components/marketing/copy";

test.describe("Enterprise visual system", () => {
  const publicPages = [
    { path: "/", root: ".min-h-screen" },
    { path: "/templates", root: ".min-h-screen" },
    { path: "/about", root: "main.min-h-screen" },
  ] as const;

  for (const pageCheck of publicPages) {
    test(`${pageCheck.path} uses the shared enterprise shell`, async ({ page }) => {
      await page.goto(pageCheck.path);
      const root = page.locator(pageCheck.root).first();
      await expect(root).toBeVisible();
      await expect(root).toHaveCSS("background-color", "rgb(7, 16, 30)");
      await expect(page.getByText("Diagrammatic", { exact: true }).first()).toBeVisible();
    });
  }

  test("structured modes use the shared light document surface", async ({ page }) => {
    await page.goto("/diagrammatic?mode=c4");
    const canvas = page.locator(".react-flow").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await expect(canvas).toHaveCSS("background-color", "rgb(248, 250, 252)");
  });

  test("Whiteboard uses the Diagrammatic cyan control theme", async ({ page }) => {
    await page.goto("/diagrammatic?mode=whiteboard");
    const excalidraw = page.locator(".diagrammatic-whiteboard .excalidraw").first();
    await expect(excalidraw).toBeVisible({ timeout: 30_000 });
    const primary = await excalidraw.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--color-primary").trim()
    );
    expect(primary).toBe("#22d3ee");
  });

  test("About lists only live, implemented capabilities", async ({ page }) => {
    await page.goto("/about");
    for (const tool of TOOLS) {
      await expect(page.getByRole("heading", { name: tool.title, exact: true })).toBeVisible();
    }
    for (const capability of CAPABILITIES) {
      await expect(
        page.getByRole("heading", { name: capability.title, exact: true })
      ).toBeVisible();
      expect(capability.status).toBe("live");
    }
    for (const unsupported of [
      "Roadmap",
      "Planned",
      "Realtime multiplayer",
      "Shared-cursor presence",
      "Code → diagram",
      "Image → diagram",
    ]) {
      await expect(page.getByText(unsupported, { exact: false })).toHaveCount(0);
    }
  });
});
