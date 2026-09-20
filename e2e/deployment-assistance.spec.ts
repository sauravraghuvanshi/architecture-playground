import { expect, test, type BrowserContext, type Download, type Page } from "@playwright/test";
import { generateArchitectureCode, generateArmTemplate } from "../components/diagrammatic/csa/architecture-codegen";
import type { ArchPayload } from "../components/diagrammatic/modes/architecture/ArchitectureCanvas";
import { parseArchitectureDocument } from "../lib/architecture-document";
import { parseArmTemplate } from "../lib/deployment-assistance";
import type { EngineeringValidation } from "../lib/engineering-validation-contract";

const architecture: ArchPayload = {
  nodes: [{
    kind: "icon", id: "app", label: "Customer web app",
    iconId: "azure/application/application-service",
    iconPath: "/cloud-icons/azure/application/application-service.svg",
    x: 80, y: 80,
  }],
  edges: [],
};
const armTemplate = parseArmTemplate(generateArmTemplate(architecture).template);
const generatedCode = generateArchitectureCode(architecture, "bicep").output;
function mockValidation(canPublish = true): EngineeringValidation {
  return {
    version: 1, profile: "azure-static-v1", artifactHash: "a".repeat(64), checkedAt: "2026-09-20T00:00:00.000Z",
    status: canPublish ? "passed-static-checks" : "needs-review", canPublish,
    checks: (["syntax", "resource-mappings", "coverage", "prerequisites", "artifact-consistency", "azure-environment"] as const).map((id) => ({
      id, status: id === "azure-environment" || (!canPublish && (id === "syntax" || id === "artifact-consistency")) ? "not-verified" : "passed",
      summary: "Deterministic browser fixture; parser correctness is tested separately.", details: [],
    })),
    coverage: [{ nodeId: "app", label: "Customer web app", status: "mapped", resourceTypes: ["Microsoft.Web/serverfarms", "Microsoft.Web/sites"], reason: "Fixture declaration coverage." }],
    parser: { name: "browser-fixture", version: "1" }, disclaimer: "Static checks do not prove deployability. Nothing executed.",
  };
}
const agentDraft = {
  source: "foundry-agent", format: "bicep", code: generatedCode,
  armTemplate,
  warnings: ["Confirm the App Service plan and run What-If before deployment."],
  assumptions: ["The workload owner will select a supported region and SKU."],
  resourceMappings: armTemplate.resources.map((resource) => ({ nodeId: "app", resourceType: resource.type, resourceName: resource.name })),
  excludedNodeIds: [], disclaimer: "Unverified draft; nothing executed.",
  validation: mockValidation(),
};

interface MockOptions {
  generationStatus?: number;
  generationBody?: unknown;
  publicationStatus?: number;
  architecture?: ArchPayload;
}

async function openDeployment(page: Page, context: BrowserContext, options: MockOptions = {}) {
  const imported = options.architecture ?? architecture;
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
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(imported.nodes.length);
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
  test("offline CLI downloads the matching template and discloses its explicit write flag without running it", async ({ page, context }) => {
    const { modal, requests } = await openDeployment(page, context);
    await modal.getByRole("button", { name: "Azure CLI", exact: true }).click();
    await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
    await expect(modal.getByRole("note")).toContainText("previews by default");
    await expect(modal.getByRole("note")).toContainText("--deploy is an explicit resource-write action");
    await expect(modal.getByRole("button", { name: "Open Azure Review + Create" })).toBeDisabled();
    for (const [button, filename, format] of [
      ["Download code", "deploy.sh", "azure-cli"],
      ["Download companion Bicep", "main.bicep", "bicep"],
    ] as const) {
      const [download] = await Promise.all([
        page.waitForEvent("download"), modal.getByRole("button", { name: button, exact: true }).click(),
      ]);
      expect(download.suggestedFilename()).toBe(filename);
      expect(await downloadText(download)).toBe(generateArchitectureCode(architecture, format).output);
    }
    expect(requests).toEqual({ generation: [], publication: [], unexpected: [] });
  });

  test("repeated Function labels export unique keyless prerequisites and a reviewable ARM companion", async ({ page, context }) => {
    const functions: ArchPayload = {
      nodes: ["one", "two"].map((id, index) => ({
        kind: "icon", id, label: "123 Function workload", x: index * 240, y: 80,
        iconId: "azure/application/function-app", iconPath: "/cloud-icons/azure/application/function-app.svg",
      })), edges: [],
    };
    const { modal, requests } = await openDeployment(page, context, { architecture: functions });
    for (const format of ["Bicep", "Terraform"] as const) {
      await modal.getByRole("button", { name: format, exact: true }).click();
      await modal.getByRole("button", { name: "Use offline starter export (no AI)", exact: true }).click();
      await expect(modal).toContainText("Naming version 2");
      await expect(modal).toContainText("authenticated public endpoints");
      const [download] = await Promise.all([
        page.waitForEvent("download"), modal.getByRole("button", { name: "Download code", exact: true }).click(),
      ]);
      expect(await downloadText(download)).toBe(generateArchitectureCode(functions, format === "Bicep" ? "bicep" : "terraform").output);
      await expect(modal.getByRole("button", { name: "Download ARM template", exact: true })).toBeEnabled();
    }
    const [download] = await Promise.all([
      page.waitForEvent("download"), modal.getByRole("button", { name: "Download ARM template", exact: true }).click(),
    ]);
    const template = JSON.parse(await downloadText(download));
    expect(template).toEqual(generateArmTemplate(functions).template);
    expect(template.resources.filter((item: { type: string }) => item.type === "Microsoft.Storage/storageAccounts")).toHaveLength(2);
    expect(template.resources.filter((item: { type: string }) => item.type === "Microsoft.Authorization/roleAssignments")).toHaveLength(2);
    expect(requests).toEqual({ generation: [], publication: [], unexpected: [] });
  });

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
    const draft = { ...agentDraft, format: "powershell", code: "# Synthetic agent script - not executed.\nWrite-Host 'Review me'\n", validation: mockValidation(false) };
    const { modal, requests } = await openDeployment(page, context, { generationBody: draft });
    await modal.getByRole("button", { name: "PowerShell", exact: true }).click();
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    await expect(modal.getByText("Runtime Foundry agent draft", { exact: true })).toBeVisible();
    await expect(modal.getByRole("note")).toHaveCount(0);
    await expect(modal.getByRole("button", { name: "Download companion Bicep" })).toHaveCount(0);
    await expect(modal.getByRole("region", { name: "Engineering validation report" })).toContainText("checks remain unverified");
    await expect(modal.getByRole("checkbox")).toBeDisabled();
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
      payload: parseArchitectureDocument(architecture), format: "bicep", context: "West Europe, private data endpoints, no credentials.",
    }]);
    await expect(modal.getByText(agentDraft.warnings[0], { exact: true })).toBeVisible();
    await expect(modal.getByText(agentDraft.assumptions[0], { exact: true })).toBeVisible();
    const validationPanel = modal.getByRole("region", { name: "Engineering validation report" });
    await expect(validationPanel).toContainText("Supported static checks passed");
    await expect(validationPanel).toContainText("azure-environment: not-verified");
    const [validationDownload] = await Promise.all([
      page.waitForEvent("download"), modal.getByRole("button", { name: "Download validation report", exact: true }).click(),
    ]);
    expect(JSON.parse(await downloadText(validationDownload))).toEqual(agentDraft.validation);

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
    expect(requests.publication).toEqual([{ source: "foundry-agent", consent: true, payload: parseArchitectureDocument(architecture), artifact: {
      format: "bicep", code: generatedCode.trim(), armTemplate, resourceMappings: agentDraft.resourceMappings,
    } }]);
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
    expect(requests.publication).toEqual([{ source: "offline", consent: true, payload: parseArchitectureDocument(architecture) }]);
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

  test("missing independent validation cannot expose a usable AI draft or publication", async ({ page, context }) => {
    const { validation: ignored, ...withoutValidation } = agentDraft;
    void ignored;
    const { modal, requests } = await openDeployment(page, context, { generationBody: withoutValidation });
    await modal.getByRole("button", { name: "Generate with Foundry agent" }).click();
    await expect(modal.getByRole("alert")).toContainText("independent validation report is missing or invalid");
    await expect(modal.getByRole("button", { name: "Download code", exact: true })).toHaveCount(0);
    expect(requests.publication).toEqual([]);
  });
});
