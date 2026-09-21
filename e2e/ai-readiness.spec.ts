import { expect, test } from "@playwright/test";
import { waitForWorkspace } from "./wait-for-workspace";

test("image generation stays disabled until independent readiness flags arrive", async ({ page }) => {
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/ai/status", async (route) => {
    await responseReady;
    await route.fulfill({ json: { imageConfigured: true, diagramConfigured: false } });
  });
  await page.goto("/diagrammatic?mode=whiteboard");
  await waitForWorkspace(page);
  const button = page.getByRole("button", { name: "AI Assist", exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("title", "Checking AI availability...");
  release();
  await expect(button).toBeEnabled();
});

test("stalled readiness settles to an explicit disabled error rather than checking forever", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => String(input).endsWith("/api/ai/status")
      ? new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }))
      : original(input, init);
  });
  await page.goto("/diagrammatic?mode=whiteboard");
  await waitForWorkspace(page);
  const button = page.getByRole("button", { name: "AI Assist", exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("title", "AI availability could not be checked. Reload to try again.", { timeout: 15_000 });
  await expect(button).toBeDisabled();
});

for (const scenario of ["unavailable", "malformed", "ambiguous combined flag"] as const) {
  test(`AI availability ${scenario} is explicit and never enables generation`, async ({ page }) => {
    await page.route("**/api/ai/status", (route) => route.fulfill(
      scenario === "unavailable"
        ? { status: 503, body: "PRIVATE_PROVIDER_DETAIL_MUST_NOT_BE_EXPOSED" }
        : scenario === "malformed" ? { json: { configured: true, imageConfigured: "true", diagramConfigured: false } }
          : { json: { configured: true } },
    ));
    const statusResponse = page.waitForResponse((response) => response.url().endsWith("/api/ai/status"));
    await page.goto("/diagrammatic?mode=whiteboard");
    expect(await (await statusResponse).finished()).toBeNull();
    await waitForWorkspace(page);
    const button = page.getByRole("button", { name: "AI Assist", exact: true });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("title", "AI availability could not be checked. Reload to try again.");
    await expect(page.getByText("PRIVATE_PROVIDER_DETAIL_MUST_NOT_BE_EXPOSED")).toHaveCount(0);
  });
}
