import { expect, test } from "@playwright/test";
import { privacyFixture } from "./ai-privacy-fixture";
import { waitForWorkspace } from "./wait-for-workspace";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/ai/privacy", (route) => route.fulfill({ json: privacyFixture }));
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: {
    configured: true, diagramConfigured: true, imageConfigured: true, reviewAgentConfigured: true, deploymentAgentConfigured: true,
  } }));
});

test("review discloses actual destination and clears session inputs without touching the canvas", async ({ page }) => {
  await page.goto("/diagrammatic?prompt=Azure%20App%20Service");
  await waitForWorkspace(page);
  await expect(page.locator(".react-flow__node-icon")).toHaveCount(1);
  await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Review my architecture", exact: true });
  await expect(modal.getByRole("region", { name: "AI privacy: review" })).toContainText("https://approved-foundry.example");
  await expect(modal).toContainText("does not guarantee zero retention");
  await modal.getByRole("button", { name: "Describe", exact: true }).click();
  await modal.getByLabel("Architecture description", { exact: true }).fill("Sensitive synthetic draft");
  await modal.getByRole("button", { name: "Clear AI session", exact: true }).click();
  await expect(modal.getByLabel("Architecture description", { exact: true })).toHaveValue("");
  await modal.getByRole("button", { name: "Close architecture review", exact: true }).click();
  await expect(page.locator(".react-flow__node-icon")).toHaveCount(1);
});

test("generation distinguishes prompt egress from provider retention and clear discards native draft", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await expect(page.getByRole("button", { name: "AI Assist", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "AI Assist", exact: true });
  await expect(modal.getByRole("region", { name: "AI privacy: chat" })).toContainText("https://approved-chat.example");
  await modal.getByLabel("Describe what to build").fill("Synthetic private design");
  await modal.getByRole("button", { name: "Clear AI session", exact: true }).click();
  await expect(modal.getByLabel("Describe what to build")).toHaveValue("");
  await expect(modal).toContainText("does not delete saved diagrams");
});

test("clearing a pending review blocks late response from restoring the session", async ({ page }) => {
  let invoked = false;
  let release: (() => void) | undefined;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/ai/review", async (route) => {
    invoked = true;
    await barrier;
    await route.fulfill({ status: 503, json: { error: "Late fixture response" } }).catch(() => {});
  });
  await page.goto("/diagrammatic");
  await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Review my architecture", exact: true });
  await modal.getByRole("button", { name: "Describe", exact: true }).click();
  await modal.getByLabel("Architecture description", { exact: true }).fill("Synthetic");
  await modal.getByRole("button", { name: "Run Foundry review", exact: true }).click();
  await expect.poll(() => invoked).toBe(true);
  await modal.getByRole("button", { name: "Clear AI session", exact: true }).click();
  release!();
  await expect(modal.getByLabel("Architecture description", { exact: true })).toHaveValue("");
  await expect(modal.getByRole("region", { name: "Your personalized review" })).toHaveCount(0);
  await expect(modal.getByRole("alert")).toHaveCount(0);
});

test("real privacy endpoint returns only documented destination metadata and no-store", async ({ request }) => {
  const response = await request.get("/api/ai/privacy");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const data = await response.json();
  expect(Object.keys(data.destinations).sort()).toEqual(["chat", "deployment", "image", "review"]);
  for (const destination of Object.values(data.destinations) as Array<Record<string, unknown>>) {
    expect(Object.keys(destination).sort()).toEqual(["configured", "data", "origin", "retention", "transport"]);
    if (destination.origin) {
      const origin = new URL(String(destination.origin));
      expect(origin.pathname).toBe("/");
      expect(origin.username).toBe("");
      expect(origin.search).toBe("");
    }
  }
});
