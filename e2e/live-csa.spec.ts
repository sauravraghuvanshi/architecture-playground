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
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await page.getByLabel("Username").fill(username!);
    await page.locator('input[autocomplete="current-password"]').fill(password!);
    await page.getByRole("button", { name: "Open Diagrammatic" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/diagrammatic");
    await expect(
      page.getByRole("button", { name: "Toggle Microsoft CSA guidance" })
    ).toBeVisible();
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
    await expect(
      page.locator('[data-testid^="rf__node-"]').getByText("Azure Front Door", { exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: "Generate architecture code" }).click();
    const codeModal = page.getByRole("dialog", { name: "Architecture to code" });
    await expect(codeModal.getByTestId("generated-code")).toContainText(
      "azureADOnlyAuthentication: true"
    );
    await codeModal.getByRole("button", { name: "Close architecture to code" }).click();

    await page.getByRole("button", { name: "Review Azure architecture" }).click();
    const reviewModal = page.getByRole("dialog", { name: "Azure architecture review" });
    await expect(reviewModal.getByText("Cross-framework Azure review")).toBeVisible();
    await reviewModal.getByRole("button", { name: "Close Azure architecture review" }).click();

    await page.getByRole("button", { name: "Deploy architecture to Azure" }).click();
    const deployModal = page.getByRole("dialog", { name: "Deploy architecture to Azure" });
    await expect(deployModal.getByText("Azure remains the control plane")).toBeVisible();
    await expect(
      deployModal.getByRole("button", { name: "Open Azure Review + Create" })
    ).toBeDisabled();

    const logout = await page.request.post("/api/auth/logout");
    expect(logout.ok()).toBeTruthy();
    await page.goto("/diagrammatic");
    await expect(page).toHaveURL(/\/login\?next=%2Fdiagrammatic$/);
  });
});
