import { expect, test } from "@playwright/test";
import { readSavedDiagram } from "./read-saved-diagram";

test.skip(
  process.env.LIVE_INVOKE_AI !== "true" || !process.env.PLAYWRIGHT_STORAGE_STATE,
  "Requires explicit paid-inference opt-in and an authenticated browser storage state.",
);

test("real guided design applies to a named document and receives a personalized Foundry review", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/diagrammatic");
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "AI Assist", exact: true });
  await modal.getByLabel("Describe what to build").fill("Create a simple Azure App Service connected to Azure SQL Database. Synthetic test only.");
  await modal.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(modal.getByRole("region", { name: "Guided design preview" })).toBeVisible({ timeout: 130_000 });
  await modal.getByRole("button", { name: "Apply generated design", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect.poll(async () => (await readSavedDiagram(page, "AI design proposal"))?.mode).toBe("architecture");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();

  await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review my architecture", exact: true });
  await review.getByPlaceholder(/Add business criticality/).fill("Synthetic prototype. Four-hour recovery target. Deployment settings are unverified.");
  await review.getByRole("button", { name: "Run Foundry review", exact: true }).click();
  await expect(review.getByRole("region", { name: "Your personalized review" })).toBeVisible({ timeout: 130_000 });
  await expect(review.getByRole("region", { name: "Your personalized review" }).getByRole("article").first()).toBeVisible();
});

test("real Whiteboard image generation inserts decoded image data into the browser draft", async ({ page }) => {
  test.setTimeout(330_000);
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "AI Assist", exact: true });
  await modal.getByLabel("Describe the image to generate").fill("Two simple labeled boxes, Web app and Database, with one arrow on a white background. No people or logos.");
  await modal.getByLabel("Visual style", { exact: true }).selectOption("executive");
  await modal.getByRole("button", { name: "Generate image", exact: true }).click();
  await expect(modal).toHaveCount(0, { timeout: 285_000 });
  await expect.poll(() => page.evaluate(() => {
    const payload = JSON.parse(localStorage.getItem("diagrammatic.draft.whiteboard") ?? "{}").payload;
    return payload?.elements?.some((element: { type: string; fileId?: string }) =>
      element.type === "image" && element.fileId && payload.files?.[element.fileId]?.dataURL?.startsWith("data:image/"));
  }), { timeout: 15_000 }).toBe(true);
});

test("real Foundry deployment draft reaches code and ARM previews without automatic publication", async ({ page }) => {
  test.setTimeout(180_000);
  const publications: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/deploy/template") publications.push(request.url());
  });
  await page.goto("/diagrammatic");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import architecture JSON", exact: true }).click();
  await (await chooser).setFiles({
    name: "synthetic-deployment.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      nodes: [{ id: "app", kind: "icon", label: "Synthetic web app", iconId: "azure/application/application-service",
        iconPath: "/cloud-icons/azure/application/application-service.svg", x: 0, y: 0 }],
      edges: [],
    })),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(1, { timeout: 15_000 });
  await page.getByRole("button", { name: "Deploy architecture to Azure", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Deploy architecture to Azure", exact: true });
  await modal.getByRole("button", { name: "Generate with Foundry agent", exact: true }).click();
  await expect(modal.getByText("Runtime Foundry agent draft", { exact: true })).toBeVisible({ timeout: 130_000 });
  await expect(modal.getByTestId("generated-code")).toContainText("Microsoft.Web");
  await modal.getByRole("button", { name: "ARM template for Portal", exact: true }).click();
  await expect(modal.getByTestId("generated-arm-template")).toContainText("Microsoft.Web/sites");
  await expect(modal.getByRole("button", { name: "Open Azure Review + Create", exact: true })).toBeDisabled();
  expect(publications).toEqual([]);
});
