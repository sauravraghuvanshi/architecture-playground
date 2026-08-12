import { expect, test } from "@playwright/test";

const modes = [
  "architecture",
  "flowchart",
  "mindmap",
  "sequence",
  "er",
  "uml",
  "whiteboard",
  "kanban",
  "c4",
] as const;

const modeLabels: Record<(typeof modes)[number], string> = {
  architecture: "Cloud Architecture",
  flowchart: "Flowchart",
  mindmap: "Mind Map",
  sequence: "Sequence Diagram",
  er: "ER Diagram",
  uml: "UML",
  whiteboard: "Whiteboard",
  kanban: "Kanban Board",
  c4: "C4 / System",
};

test("toggles and persists a white or black canvas for every diagram mode", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  for (const mode of modes) {
    await page.goto(`/diagrammatic?mode=${mode}`);
    await expect(page.getByRole("tab", { name: modeLabels[mode] })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const surface = page.locator(".diagrammatic-canvas-surface");
    const initialTheme = mode === "whiteboard" || mode === "kanban" ? "dark" : "light";
    const nextTheme = initialTheme === "light" ? "dark" : "light";
    await expect(surface).toHaveAttribute("data-canvas-theme", initialTheme);

    await page
      .getByRole("button", {
        name: `Switch to ${nextTheme === "light" ? "white" : "black"} canvas`,
      })
      .click();
    await expect(surface).toHaveAttribute("data-canvas-theme", nextTheme);

    if (mode === "whiteboard") {
      await expect(surface.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForFunction(
        (expected) => {
          const raw = localStorage.getItem("diagrammatic.draft.whiteboard");
          if (!raw) return false;
          const parsed = JSON.parse(raw) as {
            payload?: { appState?: { viewBackgroundColor?: string } };
          };
          return parsed.payload?.appState?.viewBackgroundColor === expected;
        },
        nextTheme === "light" ? "#f8fafc" : "#05080d"
      );
    } else {
      const canvas =
        mode === "kanban"
          ? surface.locator(".diagrammatic-kanban")
          : surface.locator(".react-flow").first();
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(() => canvas.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe(nextTheme === "light" ? "rgb(248, 250, 252)" : "rgb(5, 8, 13)");
    }
  }

  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".diagrammatic-canvas-surface")).toHaveAttribute(
    "data-canvas-theme",
    "light"
  );
});
