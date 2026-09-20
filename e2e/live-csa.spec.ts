import { expect, test } from "@playwright/test";

const username = process.env.E2E_AUTH_USERNAME;
const password = process.env.E2E_AUTH_PASSWORD;
const liveEnabled = process.env.LIVE_E2E === "true";
test.use({ storageState: { cookies: [], origins: [] } });
const architecture = {
  nodes: [{
    kind: "icon", id: "live-app", label: "Acceptance web app",
    iconId: "azure/application/application-service",
    iconPath: "/cloud-icons/azure/application/application-service.svg", x: 80, y: 80,
  }],
  edges: [],
};

test.describe("Live workspace navigation and explicit offline workflow", () => {
  test.skip(!liveEnabled || !username || !password, "Live URL and authentication credentials are not configured.");

  test("authenticates, reports named-agent capabilities and previews without agent calls or publication", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await page.getByLabel("Username").fill(username!);
    await page.locator('input[autocomplete="current-password"]').fill(password!);
    await page.getByRole("button", { name: "Open Diagrammatic" }).click();
    await expect(page).toHaveURL("/");

    const statusResponse = await page.evaluate(async () => {
      const response = await fetch("/api/ai/status");
      return { ok: response.ok, capabilities: await response.json() };
    });
    expect(statusResponse.ok).toBe(true);
    const capabilities = statusResponse.capabilities;
    expect(typeof capabilities.reviewAgentConfigured).toBe("boolean");
    expect(typeof capabilities.deploymentAgentConfigured).toBe("boolean");
    for (const [role, configured] of [
      ["review", capabilities.reviewAgentConfigured],
      ["deployment", capabilities.deploymentAgentConfigured],
    ] as const) {
      test.info().annotations.push({
        type: "Foundry capability",
        description: `${role} agent ${configured ? "configured but not invoked" : "unavailable; not exercised"}. Generic model configuration is not agent acceptance.`,
      });
    }

    // Guard against accidental live agent charges or publication as UI evolves.
    const prohibitedRequests: string[] = [];
    await page.route("**/api/ai/review", async (route) => {
      prohibitedRequests.push("review invocation");
      await route.fulfill({ status: 503, json: { error: "Live navigation smoke does not invoke agents." } });
    });
    await page.route("**/api/ai/deploy", async (route) => {
      prohibitedRequests.push("deployment invocation");
      await route.fulfill({ status: 503, json: { error: "Live navigation smoke does not invoke agents." } });
    });
    await page.route("**/api/deploy/template", async (route) => {
      prohibitedRequests.push("template publication");
      await route.fulfill({ status: 400, json: { error: "Live navigation smoke does not publish templates." } });
    });

    await page.goto("/diagrammatic");
    await expect(page.getByRole("button", { name: "My diagrams", exact: true })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("button", { name: "Review my architecture", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deploy architecture to Azure" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Toggle Microsoft CSA guidance" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Generate architecture code" })).toHaveCount(0);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import architecture JSON" }).click();
    await (await chooser).setFiles({
      name: "live-acceptance.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(architecture)),
    });
    await expect(page.locator(".react-flow__node").filter({ hasText: "Acceptance web app" })).toBeVisible();

    await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
    const review = page.getByRole("dialog", { name: "Review my architecture", exact: true });
    await expect(review.getByRole("button", { name: "Current canvas", exact: true })).toBeVisible();
    await expect(review.getByRole("button", { name: "Upload diagram", exact: true })).toBeVisible();
    await review.getByRole("button", { name: "Close architecture review", exact: true }).click();

    await page.getByRole("button", { name: "Deploy architecture to Azure" }).click();
    const deploy = page.getByRole("dialog", { name: "Deploy architecture to Azure" });
    await expect(deploy.getByRole("button", { name: "Generate with Foundry agent" })).toBeVisible();
    await expect(deploy.getByTestId("generated-code")).toHaveCount(0);
    await deploy.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
    await expect(deploy.getByText("Offline deterministic starter - not AI", { exact: true })).toBeVisible();
    await expect(deploy.getByTestId("generated-code")).toContainText("Microsoft.Web/sites");
    await deploy.getByRole("button", { name: "ARM template for Portal", exact: true }).click();
    await expect(deploy.getByTestId("generated-arm-template")).toContainText("Microsoft.Web/sites");
    const publish = deploy.getByRole("button", { name: "Open Azure Review + Create" });
    await expect(publish).toBeDisabled();
    await deploy.getByRole("checkbox", { name: /I reviewed the generated code, ARM template and warnings/ }).check();
    await expect(publish).toBeEnabled();
    // Deliberately do not publish; mocked local journeys cover the POST contract.
    await deploy.getByRole("button", { name: "Close Azure deployment" }).click();

    await page.getByRole("tab", { name: "Whiteboard", exact: true }).click();
    const whiteboard = page.locator(".diagrammatic-whiteboard");
    await expect(whiteboard.locator(".excalidraw").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Activate Whiteboard flow arrow" })).toBeVisible();
    const surface = page.locator(".diagrammatic-canvas-surface");
    const theme = await surface.getAttribute("data-canvas-theme");
    await page.getByRole("button", { name: /Switch to (white|black) canvas/ }).click();
    await expect(surface).toHaveAttribute("data-canvas-theme", theme === "light" ? "dark" : "light");
    await whiteboard.locator('[data-testid="main-menu-trigger"]').click();
    await expect(page.getByText("Import library from URL", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Browse public libraries", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Help", { exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("button", { name: "GIF · ordered request flow" })).toBeVisible();

    expect(prohibitedRequests).toEqual([]);
    test.info().annotations.push({ type: "Safety", description: "Offline preview and consent gating only; no live agent calls, template publication or Azure deployment." });

    const loggedOut = await page.evaluate(async () =>
      (await fetch("/api/auth/logout", { method: "POST" })).ok);
    expect(loggedOut).toBe(true);
    await page.goto("/diagrammatic");
    await expect(page).toHaveURL(/\/login\?next=%2Fdiagrammatic$/);
  });
});
