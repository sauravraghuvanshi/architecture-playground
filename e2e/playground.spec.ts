import { test, expect } from "@playwright/test";

test.describe("Architecture Playground", () => {
  test("loads, renders palette, and exports JSON", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "Mobile Safari" || testInfo.project.name === "Mobile Chrome",
      "Playground is desktop-first; mobile shows a simplified UI");

    await page.goto("/");

    // Toolbar visible
    await expect(page.getByRole("button", { name: /Fit view/i })).toBeVisible();

    // Palette tabs visible
    await expect(page.getByRole("tab", { name: /Azure/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /AWS/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Google Cloud/i })).toBeVisible();

    // Templates dropdown is populated
    const templates = page.getByLabel("Load template");
    await expect(templates).toBeVisible();
    const opts = await templates.locator("option").allTextContents();
    expect(opts.length).toBeGreaterThan(1);

    // Load a template (3-tier on Azure)
    await templates.selectOption({ label: "3-Tier on Azure" });
    await page.waitForTimeout(500);

    // Trigger JSON export and verify download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export JSON/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });
});
