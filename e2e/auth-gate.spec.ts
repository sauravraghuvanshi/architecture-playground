import { expect, test } from "@playwright/test";

const username = process.env.E2E_AUTH_USERNAME;
const password = process.env.E2E_AUTH_PASSWORD;

test.describe("Workspace access gate", () => {
  test.skip(!username || !password, "Authentication test credentials are not configured.");

  test("protects routes, signs in, issues an HttpOnly cookie, and signs out", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await expect(
      page.getByRole("heading", { name: "Welcome to Diagrammatic" })
    ).toBeVisible();

    const unauthorized = await page.request.get("/api/ai/status");
    expect(unauthorized.status()).toBe(401);

    await page.getByLabel("Username").fill(username!);
    const passwordInput = page.locator('input[autocomplete="current-password"]');
    await passwordInput.fill("incorrect-password");
    await page.getByRole("button", { name: "Open Diagrammatic" }).click();
    await expect(page.getByText("Invalid username or password.")).toBeVisible();

    await passwordInput.fill(password!);
    await page.getByRole("button", { name: "Open Diagrammatic" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByText("What are you architecting today?")).toBeVisible();

    const session = (await page.context().cookies()).find(
      (cookie) => cookie.name === "diagrammatic_session"
    );
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Strict");

    await page.goto("/login?next=/%5Cexample.com");
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/diagrammatic");
    await expect(page).toHaveURL(/\/login\?next=%2Fdiagrammatic$/);
  });
});
