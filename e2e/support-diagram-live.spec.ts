import { expect, test } from "@playwright/test";
import { supportDemo } from "../scripts/fixtures/support-demo.mjs";
import { waitForWorkspace } from "./wait-for-workspace";
import { writeFile } from "node:fs/promises";

test.skip(process.env.LIVE_INVOKE_AI !== "true" || !process.env.PLAYWRIGHT_STORAGE_STATE,
  "Explicit hosted AI verification with synthetic screenshot evidence only.");

test.beforeEach(async ({ page }) => {
  await page.goto("/diagrammatic");
  await waitForWorkspace(page);
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "synthetic-support-demo.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(supportDemo)),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(8);
});

test("customer support screenshot diagram receives a grounded review", async ({ page }) => {
  test.setTimeout(180_000);
  await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review my architecture", exact: true });
  const reviewResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/ai/review" && response.request().method() === "POST");
  await review.getByRole("button", { name: "Run Foundry review" }).click();
  const response = await reviewResponse;
  const report = await response.json();
  await writeFile(test.info().outputPath("support-review.json"), JSON.stringify(report, null, 2));
  expect(response.status()).toBe(200);
  await expect(review.getByRole("region", { name: "Your personalized review" })).toBeVisible();
  await expect(review.getByRole("region", { name: "Review provenance" })).toContainText("Runtime verified: no");
});

test("customer support screenshot diagram receives validated code without publication", async ({ page }) => {
  test.setTimeout(180_000);
  await page.getByRole("button", { name: "Deploy architecture to Azure", exact: true }).click();
  const deploy = page.getByRole("dialog", { name: "Deploy architecture to Azure", exact: true });
  const codeResponse = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === "/api/ai/deploy" && candidate.request().method() === "POST");
  await deploy.getByRole("button", { name: "Generate with Foundry agent", exact: true }).click();
  const code = await codeResponse;
  const draft = await code.json();
  await writeFile(test.info().outputPath("support-code.json"), JSON.stringify(draft, null, 2));
  expect(code.status()).toBe(200);
  await expect(deploy.getByTestId("generated-code")).toBeVisible();
  expect(draft.validation?.checks.find((check: { id: string }) => check.id === "syntax")?.status).toBe("passed");
  await expect(deploy.getByRole("button", { name: "Open Azure Review + Create" })).toBeDisabled();
  expect(draft.code).toContain("Microsoft.");
});
