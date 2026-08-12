import { expect, test } from "@playwright/test";

const username = process.env.E2E_AUTH_USERNAME;
const password = process.env.E2E_AUTH_PASSWORD;
const liveEnabled = process.env.LIVE_E2E === "true";

test.describe("Live Microsoft CSA workspace", () => {
  test.skip(
    !liveEnabled || !username || !password,
    "Live URL and authentication credentials are not configured."
  );

  test("signs in and exercises the deployed CSA workflow", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await page.getByLabel("Username").fill(username!);
    await page.locator('input[autocomplete="current-password"]').fill(password!);
    await page.getByRole("button", { name: "Open Diagrammatic" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/diagrammatic");
    await expect(
      page.getByRole("button", { name: "Toggle Microsoft CSA guidance" })
    ).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("button", { name: "Generate architecture code" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review Azure architecture" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deploy architecture to Azure" })).toBeVisible();

    await page.getByRole("button", { name: "Toggle Microsoft CSA guidance" }).click();
    const guidance = page.getByRole("complementary", { name: "Microsoft CSA guidance" });
    await expect(guidance.getByRole("button", { name: "Architecture Center" })).toBeVisible();
    await expect(guidance.getByRole("button", { name: "Landing zones" })).toBeVisible();
    await expect(guidance.getByRole("button", { name: "CAF", exact: true })).toBeVisible();
    await expect(guidance.getByRole("button", { name: "WAF", exact: true })).toBeVisible();

    const nTier = guidance.getByRole("article").filter({ hasText: "N-tier" });
    await nTier.getByRole("button", { name: "Apply pattern" }).click();

    await page.getByRole("button", { name: "Generate architecture code" }).click();
    const codeModal = page.getByRole("dialog", { name: "Architecture to code" });
    const generatedCode = codeModal.getByTestId("generated-code");
    await expect(generatedCode).toContainText("Microsoft.Cdn/profiles", { timeout: 15000 });
    await expect(generatedCode).toContainText("azureADOnlyAuthentication: true");
    await codeModal.getByRole("button", { name: "Close architecture to code" }).click();

    await page.getByRole("button", { name: "Review Azure architecture" }).click();
    const reviewModal = page.getByRole("dialog", { name: "Azure architecture review" });
    await expect(reviewModal.getByText("Cross-framework Azure review")).toBeVisible();
    await expect(
      reviewModal.getByRole("button", { name: "Upload diagram" })
    ).toBeVisible();
    await reviewModal.getByRole("button", { name: "Close Azure architecture review" }).click();

    await page.getByRole("button", { name: "Deploy architecture to Azure" }).click();
    const deployModal = page.getByRole("dialog", { name: "Deploy architecture to Azure" });
    await expect(deployModal.getByText("Azure remains the control plane")).toBeVisible();
    await expect(
      deployModal.getByRole("button", { name: "Open Azure Review + Create" })
    ).toBeDisabled();

    await deployModal.getByRole("button", { name: "Close Azure deployment" }).click();
    await page.getByRole("tab", { name: "Whiteboard" }).click();
    const whiteboard = page.locator(".diagrammatic-whiteboard");
    await expect(whiteboard.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "Activate Whiteboard flow arrow" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Switch to white canvas" }).click();
    await expect(page.locator(".diagrammatic-canvas-surface")).toHaveAttribute(
      "data-canvas-theme",
      "light"
    );
    await whiteboard.locator('[data-testid="main-menu-trigger"]').click();
    await expect(page.getByText("Import library from URL", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Browse public libraries", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Help", { exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Export" }).click();
    await expect(
      page.getByRole("button", { name: "GIF · ordered request flow" })
    ).toBeVisible();

    const logout = await page.request.post("/api/auth/logout");
    expect(logout.ok()).toBeTruthy();
    await page.goto("/diagrammatic");
    await expect(page).toHaveURL(/\/login\?next=%2Fdiagrammatic$/);
  });
});
