import { expect, test } from "@playwright/test";

test.describe("Microsoft CSA guidance", () => {
  test("explores and applies an Azure Architecture Center pattern", async ({ page }) => {
    await page.goto("/diagrammatic");

    await page.getByRole("button", { name: "Toggle Microsoft CSA guidance" }).click();
    const guidance = page.getByRole("complementary", { name: "Microsoft CSA guidance" });

    await expect(guidance.getByRole("button", { name: "Architecture Center" })).toBeVisible();
    await expect(guidance.getByText("N-tier", { exact: true })).toBeVisible();
    await expect(guidance.getByText("Web-Queue-Worker", { exact: true })).toBeVisible();

    await guidance.getByPlaceholder("Search patterns").fill("event");
    await expect(guidance.getByText("Event-driven architecture", { exact: true })).toBeVisible();
    await expect(guidance.getByText("N-tier", { exact: true })).toBeHidden();

    await guidance.getByPlaceholder("Search patterns").fill("");
    const nTier = guidance.getByRole("article").filter({ hasText: "N-tier" });
    await nTier.getByRole("button", { name: "Apply pattern" }).click();

    const canvasNodes = page.locator('[data-testid^="rf__node-"]');
    await expect(canvasNodes.getByText("Azure Front Door", { exact: true })).toBeVisible();
    await expect(canvasNodes.getByText("SQL Database", { exact: true })).toBeVisible();
  });

  test("shows searchable Azure design principles", async ({ page }) => {
    await page.goto("/diagrammatic");
    await page.getByRole("button", { name: "Toggle Microsoft CSA guidance" }).click();

    const guidance = page.getByRole("complementary", { name: "Microsoft CSA guidance" });
    await guidance.getByRole("button", { name: "Principles" }).click();
    await guidance.getByPlaceholder("Search principles").fill("identity");

    await expect(guidance.getByText("Design for security", { exact: true })).toBeVisible();
    await expect(guidance.getByText("Scale out", { exact: true })).toBeHidden();
    await expect(guidance.getByRole("link", { name: "Official guidance" }).first()).toHaveAttribute(
      "href",
      /^https:\/\/learn\.microsoft\.com\/azure\/architecture\//
    );
  });

  test("plans an Azure Landing Zones IaC Accelerator implementation", async ({ page }) => {
    await page.goto("/diagrammatic");
    await page.getByRole("button", { name: "Toggle Microsoft CSA guidance" }).click();

    const guidance = page.getByRole("complementary", { name: "Microsoft CSA guidance" });
    await guidance.getByRole("button", { name: "Landing zones" }).click();

    await expect(
      guidance.getByRole("heading", { name: "Azure Landing Zones IaC Accelerator" })
    ).toBeVisible();
    await guidance.getByLabel("Terraform").check();
    await guidance.getByLabel("Azure DevOps").check();
    await expect(guidance.getByText("Terraform + Azure DevOps")).toBeVisible();
    await expect(guidance.getByText("Phase 0")).toBeVisible();
    await expect(guidance.getByText("Phase 3")).toBeVisible();

    await guidance.getByRole("button", { name: "Mark Identity and access management complete" }).click();
    await expect(guidance.getByText("1/8")).toBeVisible();
    await expect(guidance.getByRole("link", { name: "Open official accelerator" })).toHaveAttribute(
      "href",
      "https://aka.ms/alz/acc/tf"
    );
  });

  test("tracks a Cloud Adoption Framework journey", async ({ page }) => {
    await page.goto("/diagrammatic");
    await page.getByRole("button", { name: "Toggle Microsoft CSA guidance" }).click();

    const guidance = page.getByRole("complementary", { name: "Microsoft CSA guidance" });
    await guidance.getByRole("button", { name: "CAF", exact: true }).click();

    await expect(guidance.getByText("Cloud Adoption Framework")).toBeVisible();
    await expect(guidance.getByText(/Recommended next focus: Strategy/)).toBeVisible();
    await guidance.getByRole("button", { name: "Mark Strategy complete" }).click();
    await expect(guidance.getByText("1/7 · 14%")).toBeVisible();
    await expect(guidance.getByText(/Recommended next focus: Plan/)).toBeVisible();

    await expect(
      guidance.getByRole("link", { name: "Official Strategy guidance" })
    ).toHaveAttribute(
      "href",
      "https://learn.microsoft.com/azure/cloud-adoption-framework/strategy/"
    );
    await expect(guidance.getByText("Govern", { exact: true })).toBeVisible();
    await expect(guidance.getByText("Secure", { exact: true })).toBeVisible();
    await expect(guidance.getByText("Manage", { exact: true })).toBeVisible();
  });

  test("scores evidence across the Well-Architected pillars", async ({ page }) => {
    await page.goto("/diagrammatic");
    await page.getByRole("button", { name: "Toggle Microsoft CSA guidance" }).click();

    const guidance = page.getByRole("complementary", { name: "Microsoft CSA guidance" });
    await guidance.getByRole("button", { name: "WAF", exact: true }).click();

    await expect(guidance.getByText("Evidence-based workload assessment")).toBeVisible();
    await expect(guidance.getByText("0%").first()).toBeVisible();
    await guidance
      .getByLabel("SLOs, availability targets, RTO, and RPO are documented and tested.")
      .check();
    await expect(guidance.getByText("7%").first()).toBeVisible();
    await expect(guidance.getByText("Reliability", { exact: true }).first()).toBeVisible();
    await expect(guidance.getByText("33%").first()).toBeVisible();
    await expect(guidance.getByText("14 discovery gaps remain")).toBeVisible();
    await expect(
      guidance.getByLabel("Official Security guidance")
    ).toHaveAttribute("href", "https://learn.microsoft.com/azure/well-architected/security/");
  });

  test("generates Bicep, Terraform, Azure CLI, and PowerShell from the canvas", async ({
    page,
  }) => {
    await page.goto("/diagrammatic");
    await page.getByRole("button", { name: "Toggle Microsoft CSA guidance" }).click();
    const guidance = page.getByRole("complementary", { name: "Microsoft CSA guidance" });
    const nTier = guidance.getByRole("article").filter({ hasText: "N-tier" });
    await nTier.getByRole("button", { name: "Apply pattern" }).click();

    await page.getByRole("button", { name: "Generate architecture code" }).click();
    const modal = page.getByRole("dialog", { name: "Architecture to code" });
    const code = modal.getByTestId("generated-code");

    await expect(code).toContainText("targetScope = 'resourceGroup'");
    await expect(code).toContainText("azureADOnlyAuthentication: true");
    await expect(code).not.toContainText("administratorLoginPassword");

    await modal.getByRole("button", { name: "Terraform" }).click();
    await expect(code).toContainText('provider "azurerm"');
    await expect(code).toContainText("azuread_authentication_only = true");

    await modal.getByRole("button", { name: "Azure CLI" }).click();
    await expect(code).toContainText("az group create");
    await expect(code).toContainText("--enable-ad-only-auth");

    await modal.getByRole("button", { name: "PowerShell" }).click();
    await expect(code).toContainText("New-AzResourceGroupDeployment");
    await expect(code).toContainText("-WhatIf");
  });

  test("reviews a described architecture across all Azure guidance frameworks", async ({
    page,
  }) => {
    await page.route("**/api/ai/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ diagramConfigured: true, imageConfigured: false }),
      })
    );
    await page.route("**/api/ai/review", async (route) => {
      const request = route.request().postDataJSON() as { source: string; description: string };
      expect(request.source).toBe("description");
      expect(request.description).toContain("two-region");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          review: {
            summary: "The architecture has a sound managed-services baseline but needs tested recovery evidence.",
            posture: "mixed",
            score: 72,
            strengths: ["Managed edge and application services are explicit."],
            assumptions: ["RTO, RPO, and landing-zone ownership require confirmation."],
            findings: [
              {
                id: "rel-recovery",
                title: "Recovery objectives are not evidenced",
                severity: "high",
                framework: "Well-Architected Framework",
                pillar: "Reliability",
                evidence: "The description identifies two regions but no tested recovery objectives.",
                recommendation: "Define, implement, and exercise RTO and RPO for critical user journeys.",
                sourceUrl: "https://learn.microsoft.com/azure/well-architected/",
              },
              {
                id: "alz-governance",
                title: "Platform governance ownership is unclear",
                severity: "medium",
                framework: "Azure Landing Zones",
                pillar: "Governance",
                evidence: "No subscription, policy, or platform ownership model was supplied.",
                recommendation: "Confirm landing-zone design areas and policy ownership before production.",
                sourceUrl:
                  "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/",
              },
            ],
          },
        }),
      });

    });

    await page.goto("/diagrammatic");
    await page.getByRole("button", { name: "Review Azure architecture" }).click();
    const modal = page.getByRole("dialog", { name: "Azure architecture review" });
    await modal.getByRole("button", { name: "Describe" }).click();
    await modal.getByPlaceholder(/Explain business criticality/).fill(
      "A two-region Azure application uses Front Door, App Service, Service Bus, and Azure SQL."
    );
    await modal.getByRole("button", { name: "Run architecture review" }).click();

    await expect(modal.getByText("72")).toBeVisible();
    await expect(modal.getByText("Recovery objectives are not evidenced")).toBeVisible();
    await expect(modal.getByText("Platform governance ownership is unclear")).toBeVisible();
    await expect(modal.getByText("Well-Architected Framework")).toBeVisible();
    await expect(modal.getByText("Azure Landing Zones")).toBeVisible();
  });

  test("uploads an architecture image and returns a rated improvement review", async ({
    page,
  }) => {
    await page.route("**/api/ai/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ diagramConfigured: true, imageConfigured: false }),
      })
    );
    await page.route("**/api/ai/review", async (route) => {
      const request = route.request().postDataJSON() as {
        source: string;
        description: string;
        image: { name: string; mimeType: string; dataUrl: string };
      };
      expect(request.source).toBe("image");
      expect(request.description).toContain("four-hour RTO");
      expect(request.image.name).toBe("customer-architecture.png");
      expect(request.image.mimeType).toBe("image/png");
      expect(request.image.dataUrl).toMatch(/^data:image\/png;base64,/);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          review: {
            summary:
              "The visual shows a clear Azure application flow, but platform governance and recovery evidence need strengthening.",
            posture: "mixed",
            score: 74,
            strengths: ["Managed ingress and application services are visible."],
            assumptions: ["Subscription topology and data classification are not visible."],
            findings: [
              {
                id: "aac-1",
                title: "Add asynchronous workload isolation",
                severity: "medium",
                framework: "Azure Architecture Center",
                pillar: "Design patterns",
                evidence: "The diagram shows direct synchronous dependencies.",
                recommendation: "Add queue-based load leveling for long-running work.",
                sourceUrl: "https://learn.microsoft.com/azure/architecture/",
              },
              {
                id: "alz-1",
                title: "Define application landing zone controls",
                severity: "high",
                framework: "Azure Landing Zones",
                pillar: "Governance",
                evidence: "No policy, subscription, or connectivity boundary is visible.",
                recommendation: "Place the workload in a governed application landing zone.",
                sourceUrl:
                  "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/",
              },
              {
                id: "caf-1",
                title: "Connect the workload to adoption outcomes",
                severity: "low",
                framework: "Cloud Adoption Framework",
                pillar: "Manage",
                evidence: "Business outcomes and operational ownership are not represented.",
                recommendation: "Document measurable outcomes and the cloud operating model.",
                sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/",
              },
              {
                id: "waf-1",
                title: "Test recovery objectives",
                severity: "high",
                framework: "Well-Architected Framework",
                pillar: "Reliability",
                evidence: "A four-hour RTO is stated but no recovery path is visible.",
                recommendation: "Implement and exercise regional recovery against the stated RTO.",
                sourceUrl: "https://learn.microsoft.com/azure/well-architected/",
              },
            ],
          },
        }),
      });
    });

    await page.goto("/diagrammatic");
    await page.getByRole("button", { name: "Review Azure architecture" }).click();
    const modal = page.getByRole("dialog", { name: "Azure architecture review" });
    await modal.getByRole("button", { name: "Upload diagram" }).click();
    await modal.getByLabel("Upload architecture diagram image").setInputFiles({
      name: "customer-architecture.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFAAH/q842AAAAAElFTkSuQmCC",
        "base64"
      ),
    });
    await expect(
      modal.getByAltText("Architecture diagram preview: customer-architecture.png")
    ).toBeVisible();
    await modal
      .getByPlaceholder(/Add business criticality/)
      .fill("Production banking workload with a four-hour RTO and confidential data.");
    await modal.getByRole("button", { name: "Run architecture review" }).click();

    await expect(modal.getByText("74")).toBeVisible();
    await expect(modal.getByText("Add asynchronous workload isolation")).toBeVisible();
    await expect(modal.getByText("Define application landing zone controls")).toBeVisible();
    await expect(modal.getByText("Connect the workload to adoption outcomes")).toBeVisible();
    await expect(modal.getByText("Test recovery objectives")).toBeVisible();
  });

  test("hands a short-lived template to Azure Portal Review + Create", async ({ page }) => {
    await page.route("**/api/deploy/template", async (route) => {
      const request = route.request().postDataJSON() as {
        payload: { nodes: unknown[]; edges: unknown[] };
      };
      expect(request.payload.nodes.length).toBeGreaterThan(0);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          portalUrl: "about:blank#azure-review-create",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          supportedNodes: 4,
          totalServiceNodes: 7,
          warnings: [],
        }),
      });
    });

    await page.goto("/diagrammatic");
    await page.getByRole("button", { name: "Toggle Microsoft CSA guidance" }).click();
    const guidance = page.getByRole("complementary", { name: "Microsoft CSA guidance" });
    const nTier = guidance.getByRole("article").filter({ hasText: "N-tier" });
    await nTier.getByRole("button", { name: "Apply pattern" }).click();

    await page.getByRole("button", { name: "Deploy architecture to Azure" }).click();
    const modal = page.getByRole("dialog", { name: "Deploy architecture to Azure" });
    await expect(modal.getByText("Azure remains the control plane")).toBeVisible();
    const deploy = modal.getByRole("button", { name: "Open Azure Review + Create" });
    await expect(deploy).toBeDisabled();
    await modal.getByRole("checkbox").check();

    const popupPromise = page.waitForEvent("popup");
    await deploy.click();
    const popup = await popupPromise;
    await expect.poll(() => popup.url()).toContain("#azure-review-create");
  });
});
