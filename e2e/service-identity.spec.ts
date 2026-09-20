import { expect, test, type Page } from "@playwright/test";
import type { ArchIconNode, ArchPayload } from "../components/diagrammatic/modes/architecture/ArchitectureCanvas";
import { readCanvasPayload } from "./read-canvas-payload";
import { waitForWorkspace } from "./wait-for-workspace";

test.use({ viewport: { width: 1600, height: 1000 } });
test.describe.configure({ timeout: 90_000 });
const app = { id: "app", kind: "icon" as const, label: "Payments API", iconId: "azure/application/application-service", iconPath: "/cloud-icons/azure/application/application-service.svg", x: 100, y: 100 };

async function importArchitecture(page: Page, graph: ArchPayload) {
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await page.getByLabel("Architecture JSON file").setInputFiles({
    name: "identity.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(graph)),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(graph.nodes.length);
}

async function stored(page: Page): Promise<ArchPayload | undefined> {
  return await readCanvasPayload(page, "architecture") as ArchPayload | undefined;
}

test("prompt scaffolding selects one real App Service and explains incomplete requirement coverage", async ({ page }) => {
  await page.goto(`/diagrammatic?prompt=${encodeURIComponent("Azure web app with App Service and SQL Database")}`);
  await expect(page.locator(".react-flow__node-icon")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.locator('.react-flow__node-icon img[src="/cloud-icons/azure/application/application-service.svg"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__node-icon img[src*="app-service-api"]')).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Prompt coverage" })).toContainText("not a complete requirements validation");
  await expect.poll(async () => (await stored(page))?.nodes.filter((node): node is ArchIconNode => node.kind === "icon").map((node) => node.iconId).sort())
    .toEqual(["azure/application/application-service", "azure/data/sql-database"].sort());
});

test("both icon pickers find the canonical App Service alias without crossing the selected provider", async ({ page }) => {
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await page.getByRole("searchbox", { name: "Search cloud services", exact: true }).fill("Azure App Service");
  const canonical = page.getByRole("button", { name: "Application Service", exact: true });
  await expect(canonical).toBeVisible();
  await canonical.click();
  await expect(page.locator('.react-flow__node-icon img[src="/cloud-icons/azure/application/application-service.svg"]')).toHaveCount(1);
  await page.getByRole("button", { name: /^AWS258$/ }).click();
  await expect(canonical).toHaveCount(0);
  await page.goto("/legacy-playground");
  await page.getByRole("searchbox", { name: "Search services", exact: true }).fill("Azure App Service");
  const legacyCanonical = page.getByRole("button", { name: "Application Service (Azure)", exact: true });
  await expect(legacyCanonical).toBeVisible();
  await page.getByRole("tab", { name: /^AWS/ }).click();
  await expect(legacyCanonical).toHaveCount(0);
});

test("collapsed catalog categories do not flood the page with eager SVG downloads", async ({ page }) => {
  const images: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/cloud-icons/") && request.url().endsWith(".svg")) images.push(request.url()); });
  await page.goto("/diagrammatic?mode=architecture");
  await waitForWorkspace(page);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(images.length).toBeLessThan(5);
  await page.locator("aside details").first().locator("summary").click();
  const visibleImage = page.locator("aside details[open] img").first();
  await expect.poll(() => visibleImage.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(images.length).toBeGreaterThan(0);
  expect(images.length).toBeLessThan(100);
});

test("conflicting provider requests produce a clear unmet-requirement result, not an Azure substitute", async ({ page }) => {
  await page.goto(`/diagrammatic?prompt=${encodeURIComponent("Azure serverless Lambda")}`);
  await waitForWorkspace(page);
  const coverage = page.getByRole("region", { name: "Prompt coverage" });
  await expect(coverage).toContainText("belongs to AWS");
  await expect(coverage).toContainText("No draft generated");
  await expect(page.locator(".react-flow__node-icon")).toHaveCount(0);
});

test("renaming a service cannot change its offline Azure resource type", async ({ page }) => {
  await importArchitecture(page, { nodes: [app], edges: [] });
  await page.locator('.react-flow__node[data-id="app"]').getByText("Payments API", { exact: true }).click();
  const label = page.getByRole("textbox", { name: "Display name", exact: true });
  await label.fill("Azure Functions");
  await label.blur();
  await expect(page.locator('.react-flow__node[data-id="app"]')).toContainText("Azure Functions");
  await page.getByRole("button", { name: "Deploy architecture to Azure" }).click();
  const modal = page.getByRole("dialog", { name: "Deploy architecture to Azure" });
  await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
  await expect(modal.getByTestId("generated-code")).toContainText("kind: 'app,linux'");
  await expect(modal.getByTestId("generated-code")).not.toContainText("functionapp,linux");
  await modal.getByRole("button", { name: "Terraform", exact: true }).click();
  await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
  await expect(modal.getByTestId("generated-code")).toContainText("azurerm_linux_web_app");
  await expect(modal.getByTestId("generated-code")).not.toContainText("azurerm_linux_function_app");
});

for (const [name, iconId, iconPath] of [
  ["non-Azure", "aws/compute/lambda", "/cloud-icons/aws/compute/lambda.svg"],
  ["feature icon", "azure/application/app-service-api", "/cloud-icons/azure/application/app-service-api.svg"],
] as const) {
  test(`${name} cannot yield a misleading deployable Azure draft`, async ({ page }) => {
    await importArchitecture(page, { nodes: [{ ...app, iconId, iconPath, label: "Azure App Service" }], edges: [] });
    await page.getByRole("button", { name: "Deploy architecture to Azure" }).click();
    const modal = page.getByRole("dialog", { name: "Deploy architecture to Azure" });
    await modal.getByRole("button", { name: "Terraform", exact: true }).click();
    await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
    await expect(modal).toContainText("No draft or deployment artifact was generated.");
    await expect(modal.getByRole("button", { name: "Download code", exact: true })).toHaveCount(0);
  });
}

test("legacy AI application rejects unresolved identity without replacing the current graph or reporting success", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { configured: true, diagramConfigured: true, imageConfigured: false } }));
  await page.route("**/api/ai/generate", (route) => route.fulfill({ json: { graph: {
    nodes: [{ id: "wrong", type: "service", position: { x: 0, y: 0 }, data: { iconId: "aws/compute/key-vault", cloud: "aws", label: "Secret store" } }],
    edges: [],
  } } }));
  await page.goto("/legacy-playground");
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles({
    name: "retained.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
      nodes: [{ id: "keep", type: "service", position: { x: 100, y: 100 }, data: { iconId: app.iconId, cloud: "azure", label: "Keep this service" } }], edges: [],
    })),
  });
  await expect(page.locator('.react-flow__node[data-id="keep"]')).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Toggle AI Assist", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "AI Assist", exact: true });
  await panel.getByRole("textbox").fill("Synthetic unknown service fixture");
  await panel.getByRole("button", { name: "Generate", exact: true }).click();
  await panel.getByRole("button", { name: "Apply to canvas", exact: true }).click();
  await expect(panel).toContainText("Your current diagram is unchanged.");
  await expect(panel.getByText("Applied to canvas.", { exact: true })).toHaveCount(0);
  await expect(page.locator('.react-flow__node[data-id="keep"]')).toBeVisible();
  await expect(page.locator('.react-flow__node[data-id="wrong"]')).toHaveCount(0);
});
