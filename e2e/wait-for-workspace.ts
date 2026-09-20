import { expect, type Page } from "@playwright/test";

export async function waitForWorkspace(page: Page): Promise<void> {
  await expect(page.locator('div[aria-busy="false"]').filter({
    has: page.locator('input[aria-label="Architecture JSON file"]'),
  })).toBeVisible({ timeout: 30_000 });
}
