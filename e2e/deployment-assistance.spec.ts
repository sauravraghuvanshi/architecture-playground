import { expect, test, type BrowserContext, type Download, type Page } from "@playwright/test";
import { generateArchitectureCode } from "../components/diagrammatic/csa/architecture-codegen";
import type { ArchPayload } from "../components/diagrammatic/modes/architecture/ArchitectureCanvas";

const architecture: ArchPayload = {
  nodes: [{
    kind: "icon", id: "app", label: "Customer web app",
    iconId: "azure/application/application-service",
    iconPath: "/cloud-icons/azure/application/application-service.svg",
    x: 80, y: 80,
  }],
  edges: [],
};
const armTemplate = {
  $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  contentVersion: "1.0.0.0",
  resources: [{
    type: "Microsoft.Web/sites", apiVersion: "2024-04-01",
    name: "customer-app", location: "westeurope", properties: { httpsOnly: true },
  }],
};
const generatedCode = "param location string = 'westeurope'\n// Mocked Foundry response for browser acceptance.\n";
const agentDraft = {
  source: "foundry-agent", format: "bicep", code: generatedCode,
  armTemplate,
  warnings: ["Confirm the App Service plan and run What-If before deployment."],
  assumptions: ["The workload owner will select a supported region and SKU."],
  resourceMappings: [{ nodeId: "app", resourceType: "Microsoft.Web/sites", resourceName: "customer-app" }],
  excludedNodeIds: [], disclaimer: "Unverified draft; nothing executed.",
};

interface MockOptions {
  generationStatus?: number;
  generationBody?: unknown;
  publicationStatus?: number;
}

async function openDeployment(page: Page, context: BrowserContext, options: MockOptions = {}) {
  const requests = { generation: [] as unknown[], publication: [] as unknown[], unexpected: [] as string[] };
  await context.route("**/api/ai/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/ai/status") {
      await route.fulfill({ json: {
        configured: true, diagramConfigured: false, imageConfigured: false,
        reviewAgentConfigured: false, deploymentAgentConfigured: options.generationStatus !== 503,
      } });
    } else if (path === "/api/ai/deploy") {
      requests.generation.push(route.request().postDataJSON());
      await route.fulfill({
        status: options.generationStatus ?? 200,
        json: options.generationBody ?? agentDraft,
      });
    } else {
      requests.unexpected.push(path);
      await route.fulfill({ status: 503, json: { error: "Unexpected AI request blocked by local acceptance test." } });
    }
  });
  await context.route("**/api/deploy/template", async (route) => {
    requests.publication.push(route.request().postDataJSON());
    await route.fulfill({
      status: options.publicationStatus ?? 200,
      json: options.publicationStatus
        ? { error: "Azure Portal handoff unavailable. Download the ARM template and upload it manually." }
        : {
          portalUrl: "https://portal.azure.com/#create/Microsoft.Template/uri/" + encodeURIComponent("https://diagram.example/api/deploy/template?token=mock-only"),
          expiresAt: "2099-01-01T00:10:00.000Z", warnings: [],
        },
    });
  });
  // Context routing also intercepts the popup's first navigation. No Azure
  // page or hosted template is reached by these mocked browser journeys.
  await context.route("https://portal.azure.com/**", (route) => route.fulfill({
    contentType: "text/html", body: "<title>Mock Azure Portal</title><p>Mock handoff; no deployment.</p>",
  }));
  await page.goto("/diagrammatic");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import architecture JSON" }).click();
  await (await chooser).setFiles({
    name: "deployment-evidence.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(architecture)),
  });
  await expect(page.locator(".react-flow__node").filter({ hasText: "Customer web app" })).toBeVisible();
  await page.getByRole("button", { name: "Deploy architecture to Azure" }).click();
  const modal = page.getByRole("dialog", { name: "Deploy architecture to Azure" });
  await expect(modal).toBeVisible();
  return { modal, requests };
}

async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("The download was not readable.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

test.describe("Deployment assistance with mocked named-agent responses", () => {
  test("offline PowerShell downloads only a preview and the matching Bicep without publishing or invoking AI", async ({ page, context }) => {
    const { modal, requests } = await openDeployment(page, context);
    await modal.getByRole("button", { name: "PowerShell", exact: true }).click();
    await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
    await expect(modal.getByRole("note")).toContainText("Offline PowerShell preview only");
    await expect(modal.getByTestId("generated-code")).toContainText("Get-AzResourceGroupDeploymentWhatIfResult");
    await expect(modal.getByTestId("generated-code")).not.toContainText("New-AzResourceGroup");
    await expect(modal.getByRole("button", { name: "Open Azure Review + Create" })).toBeDisabled();
    const [previewDownload] = await Promise.all([
      page.waitForEvent("download"), modal.getByRole("button", { name: "Download code", exact: true }).click(),
    ]);
    expect(previewDownload.suggestedFilename()).toBe("preview.ps1");
    expect(await downloadText(previewDownload)).toBe(generateArchitectureCode(architecture, "powershell").output);
    const [bicepDownload] = await Promise.all([
      page.waitForEvent("download"), modal.getByRole("button", { name: "Download companion Bicep", exact: true }).click(),
    ]);
    expect(bicepDownload.suggestedFilename()).toBe("main.bicep");
    expect(await downloadText(bicepDownload)).toBe(generateArchitectureCode(architecture, "bicep").output);
    await modal.getByRole("button", { name: "ARM template for Portal", exact: true }).click();
    await expect(modal.getByTestId("generated-arm-template")).toContainText("Microsoft.Web/sites");
    expect(requests.generation).toEqual([]);
    expect(requests.publication).toEqual([]);
    expect(requests.unexpected).toEqual([]);
  });

  test("changing or dismissing an offline preview clears companion artifacts and never publishes", async ({ page, context }) => {
    const { modal, requests } = await openDeployment(page, context);
    let downloads = 0;
    page.on("download", () => { downloads++; });
    await modal.getByRole("button", { name: "PowerShell", exact: true }).click();
    await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
    await expect(modal.getByRole("button", { name: "Download companion Bicep" })).toBeVisible();
    await modal.getByLabel("Deployment constraints").fill("Changed assumptions");
    await expect(modal.getByRole("button", { name: "Download companion Bicep" })).toHaveCount(0);
    await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
    await modal.getByRole("button", { name: "Bicep", exact: true }).click();
    await expect(modal.getByTestId("generated-code")).toHaveCount(0);
    await modal.getByRole("button", { name: "Close Azure deployment", exact: true }).click();
    await expect(modal).toHaveCount(0);
    expect(downloads).toBe(0);
    expect(requests.generation).toEqual([]);
    expect(requests.publication).toEqual([]);
  });

  test("Foundry PowerShell remains an unverified draft and never inherits the offline preview guarantee", async ({ page, context }) => {
    const draft = { ...agentDraft, format: "powershell", code: "# Synthetic agent script - not executed.\nWrite-Host 'Review me'\n" };
    const { modal, requests } = await openDeployment(page, context, { generationBody: draft });
    await modal.getByRole("button", { name: "PowerShell", exact: true }).click();
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    await expect(modal.getByText("Runtime Foundry agent draft", { exact: true })).toBeVisible();
    await expect(modal.getByRole("note")).toHaveCount(0);
    await expect(modal.getByRole("button", { name: "Download companion Bicep" })).toHaveCount(0);
    const [download] = await Promise.all([
      page.waitForEvent("download"), modal.getByRole("button", { name: "Download code", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("deploy.ps1");
    expect(await downloadText(download)).toBe(draft.code.trim());
    expect(requests.publication).toEqual([]);
  });

  test("generates, previews and downloads code/ARM, then publishes only after explicit consent", async ({ page, context }) => {
    const { modal, requests } = await openDeployment(page, context);
    await expect(modal.getByTestId("generated-code")).toHaveCount(0);
    expect(requests.generation).toHaveLength(0);
    expect(requests.publication).toHaveLength(0);
    await modal.getByLabel("Deployment constraints").fill("West Europe, private data endpoints, no credentials.");
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    await expect(modal.getByText("Runtime Foundry agent draft", { exact: true })).toBeVisible();
    await expect(modal.getByTestId("generated-code")).toHaveText(generatedCode.trim());
    expect(requests.generation).toEqual([{
      payload: architecture, format: "bicep", context: "West Europe, private data endpoints, no credentials.",
    }]);
    await expect(modal.getByText(agentDraft.warnings[0], { exact: true })).toBeVisible();
    await expect(modal.getByText(agentDraft.assumptions[0], { exact: true })).toBeVisible();

    const codeDownload = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Download code", exact: true }).click();
    const code = await codeDownload;
    expect(code.suggestedFilename()).toBe("main.bicep");
    expect(await downloadText(code)).toBe(generatedCode.trim());
    await modal.getByRole("button", { name: "ARM template for Portal", exact: true }).click();
    await expect(modal.getByTestId("generated-arm-template")).toContainText("Microsoft.Web/sites");
    const armDownload = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Download ARM template", exact: true }).click();
    const arm = await armDownload;
    expect(arm.suggestedFilename()).toBe("azuredeploy.json");
    expect(JSON.parse(await downloadText(arm))).toEqual(armTemplate);

    const publish = modal.getByRole("button", { name: "Open Azure Review + Create" });
    await expect(publish).toBeDisabled();
    expect(requests.publication).toHaveLength(0);
    await modal.getByRole("checkbox", { name: /I reviewed the generated code, ARM template and warnings/ }).check();
    await expect(publish).toBeEnabled();
    expect(requests.publication).toHaveLength(0);
    const popupEvent = page.waitForEvent("popup");
    await publish.click();
    const popup = await popupEvent;
    await expect(popup).toHaveURL(/^https:\/\/portal\.azure\.com\//);
    await expect(popup).toHaveTitle("Mock Azure Portal");
    expect(requests.publication).toEqual([{ source: "foundry-agent", consent: true, armTemplate }]);
    await expect(modal.getByRole("status")).toContainText("nothing has been deployed");
    expect(requests.unexpected).toEqual([]);
    await popup.close();
  });

  test("unavailable agent does not silently fall back; offline source is explicitly selected and published", async ({ page, context }) => {
    const { modal, requests } = await openDeployment(page, context, {
      generationStatus: 503, generationBody: { error: "The deployment Foundry agent is not configured." },
    });
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    await expect(modal.getByRole("alert")).toContainText("not configured");
    await expect(modal.getByTestId("generated-code")).toHaveCount(0);
    await expect(modal.getByText("Offline deterministic starter - not AI", { exact: true })).toHaveCount(0);
    expect(requests.publication).toHaveLength(0);
    await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
    await expect(modal.getByText("Offline deterministic starter - not AI", { exact: true })).toBeVisible();
    await expect(modal.getByTestId("generated-code")).toContainText("Microsoft.Web/sites");
    expect(requests.generation).toHaveLength(1);
    const publish = modal.getByRole("button", { name: "Open Azure Review + Create" });
    await expect(publish).toBeDisabled();
    await modal.getByRole("checkbox", { name: /I reviewed the generated code, ARM template and warnings/ }).check();
    const popupEvent = page.waitForEvent("popup");
    await publish.click();
    const popup = await popupEvent;
    await expect(popup).toHaveTitle("Mock Azure Portal");
    expect(requests.publication).toEqual([{ source: "offline", consent: true, payload: architecture }]);
    expect(requests.unexpected).toEqual([]);
    await popup.close();
  });

  test("rejects a malformed agent draft without exposing a usable preview or publishing", async ({ page, context }) => {
    const { modal, requests } = await openDeployment(page, context, {
      generationBody: { ...agentDraft, resourceMappings: [{ ...agentDraft.resourceMappings[0], nodeId: "invented-node" }] },
    });
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    await expect(modal.getByRole("alert")).toBeVisible();
    await expect(modal.getByTestId("generated-code")).toHaveCount(0);
    await expect(modal.getByRole("button", { name: "Open Azure Review + Create" })).toHaveCount(0);
    expect(requests.publication).toHaveLength(0);
    expect(requests.unexpected).toEqual([]);
  });

  test("failed Portal handoff retains the reviewed draft and manual upload/download path", async ({ page, context }) => {
    const { modal, requests } = await openDeployment(page, context, { publicationStatus: 400 });
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    await expect(modal.getByTestId("generated-code")).toBeVisible();
    await modal.getByRole("checkbox", { name: /I reviewed the generated code, ARM template and warnings/ }).check();
    const popupEvent = page.waitForEvent("popup");
    await modal.getByRole("button", { name: "Open Azure Review + Create" }).click();
    const popup = await popupEvent;
    await expect(modal.getByRole("alert")).toContainText("upload it manually");
    await expect.poll(() => popup.isClosed()).toBe(true);
    await expect(modal.getByTestId("generated-code")).toBeVisible();
    await expect(modal.getByRole("link", { name: "Deploy a custom template" })).toHaveAttribute("href", "https://portal.azure.com/#create/Microsoft.Template");
    const downloadEvent = page.waitForEvent("download");
    await modal.getByRole("button", { name: "Download ARM template" }).click();
    expect(JSON.parse(await downloadText(await downloadEvent))).toEqual(armTemplate);
    expect(requests.publication).toHaveLength(1);
    expect(requests.unexpected).toEqual([]);
  });

  test("changing evidence constraints clears the old preview and publication consent", async ({ page, context }) => {
    const { modal, requests } = await openDeployment(page, context);
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    const consent = modal.getByRole("checkbox", { name: /I reviewed the generated code, ARM template and warnings/ });
    await consent.check();
    await expect(modal.getByRole("button", { name: "Open Azure Review + Create" })).toBeEnabled();
    await modal.getByLabel("Deployment constraints").fill("Revised budget and recovery targets.");
    await expect(modal.getByTestId("generated-code")).toHaveCount(0);
    await expect(modal.getByRole("button", { name: "Open Azure Review + Create" })).toHaveCount(0);
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    await expect(consent).not.toBeChecked();
    await expect(modal.getByRole("button", { name: "Open Azure Review + Create" })).toBeDisabled();
    expect(requests.generation).toHaveLength(2);
    expect(requests.publication).toHaveLength(0);
    expect(requests.unexpected).toEqual([]);
  });
});
