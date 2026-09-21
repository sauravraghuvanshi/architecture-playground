import { expect, test, type Page } from "@playwright/test";

const payload = {
  nodes: [
    { id: "api", kind: "icon", label: "Orders API", iconId: "azure/application/function-app", iconPath: "/cloud-icons/azure/application/function-app.svg", x: 0, y: 0 },
    { id: "monitor", kind: "icon", label: "Telemetry", iconId: "azure/management/application-insights", iconPath: "/cloud-icons/azure/management/application-insights.svg", x: 300, y: 0 },
  ],
  edges: [{ id: "telemetry", source: "api", target: "monitor" }],
};

const review = {
  summary: "Your managed-services design needs recovery evidence before production.",
  posture: "mixed",
  score: 72,
  strengths: ["Managed edge and application services are explicit."],
  assumptions: ["RTO, RPO, and landing-zone ownership require confirmation."],
  findings: [
    {
      id: "alz-governance", title: "Confirm your platform governance owner", severity: "medium",
      framework: "Azure Landing Zones", pillar: "Governance", evidenceStatus: "unknown",
      evidence: "No subscription or policy ownership model was supplied.",
      recommendation: "Confirm landing-zone design areas and policy ownership before production.",
      sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/",
      nodeIds: [], edgeIds: [],
      remediation: {
        steps: ["Confirm the platform owner.", "Record policy ownership."],
        validation: "Have the workload owner approve the ownership record.",
        tradeoff: "Ownership reviews require coordination.",
      },
    },
    {
      id: "rel-recovery", title: "Test recovery for Orders API", severity: "high",
      framework: "Well-Architected Framework", pillar: "Reliability", evidenceStatus: "unknown",
      evidence: "The supplied architecture has no tested recovery objectives.",
      recommendation: "Agree and exercise recovery objectives for the orders flow.",
      sourceUrl: "https://learn.microsoft.com/azure/well-architected/",
      nodeIds: [], edgeIds: [],
      remediation: {
        steps: ["Agree RTO and RPO for the orders flow.", "Rehearse failover and restore."],
        validation: "Measure recovery time against the agreed target.",
        tradeoff: "Extra recovery capacity increases cost and operational complexity.",
      },
    },
  ],
};

async function prepare(page: Page, agentConfigured: boolean) {
  await page.route("**/api/ai/status", (route) => route.fulfill({
    json: { diagramConfigured: true, imageConfigured: false, reviewAgentConfigured: agentConfigured, deploymentAgentConfigured: false },
  }));
  await page.addInitScript((diagram) => {
    localStorage.setItem("diagrammatic.draft", JSON.stringify({ mode: "architecture", payload: diagram }));
    localStorage.setItem("diagrammatic.draft.architecture", JSON.stringify({ payload: diagram }));
  }, payload);
  await page.goto("/diagrammatic");
  await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
  return page.getByRole("dialog", { name: "Review my architecture", exact: true });
}

test.describe("Review my architecture", () => {
  test("retains the canvas baseline across closing, deleting a real connection, and reopening", async ({ page }) => {
    const modal = await prepare(page, false);
    await expect(modal.getByTestId("waf-overall-score")).toHaveText("7/100");
    await modal.getByRole("button", { name: "Use current canvas as baseline" }).click();
    await modal.getByRole("button", { name: "Close architecture review" }).click();
    await expect(modal).toHaveCount(0);

    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await page.getByRole("button", { name: /^Select connection/ }).click();
    await page.getByRole("button", { name: "Delete selection (Del)" }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
    await expect(modal.getByTestId("waf-overall-score")).toHaveText("0/100");
    await expect(modal.getByTestId("waf-assessment-diff")).toContainText("-7 overall since baseline");
    await expect(modal.getByTestId("waf-assessment-diff")).toContainText("Removed edges: telemetry");
    await expect(modal.getByTestId("waf-assessment-diff")).toContainText("1 lost patterns");
    await expect(modal.getByTestId("waf-pillar-operational-excellence")).toContainText("-33 since baseline");

    await modal.getByRole("button", { name: "Use current canvas as baseline" }).click();
    await modal.getByRole("button", { name: "Close architecture review" }).click();
    await page.getByRole("button", { name: "Review my architecture", exact: true }).click();
    await expect(modal.getByTestId("waf-assessment-diff")).toContainText("No evidence changes since baseline");
  });

  test("replaces the generic CSA entry with a personal review and explicitly offline five-pillar scores", async ({ page }) => {
    const modal = await prepare(page, false);
    await expect(page.getByRole("button", { name: "Toggle Microsoft CSA guidance" })).toHaveCount(0);
    await expect(modal.getByText("Foundry review agent unavailable", { exact: true })).toBeVisible();
    await expect(modal.getByRole("button", { name: "Run Foundry review" })).toBeDisabled();
    await expect(modal.getByRole("heading", { name: "Offline WAF scorecard and remediation playbooks" })).toBeVisible();
    await expect(modal.getByTestId("waf-overall-score")).toHaveText("7/100");
    for (const pillar of ["reliability", "security", "cost-optimization", "operational-excellence", "performance-efficiency"]) {
      await expect(modal.getByTestId(`waf-pillar-${pillar}`)).toContainText(pillar === "operational-excellence" ? "33/100" : "0/100");
    }
    const telemetry = modal.getByTestId("waf-finding-ops-observe-path");
    await expect(telemetry).toContainText("Observed in diagram");
    await expect(telemetry).toContainText("telemetry: Orders API [api] -> Telemetry [monitor]");
    await telemetry.getByText("Remediation playbook").click();
    await expect(telemetry).toContainText("synthetic failure");
    await modal.getByText("Scoring method and limitations").click();
    await expect(modal.getByText(/not an official Azure assessment, compliance certification/)).toBeVisible();
  });

  test("ranks Foundry findings and node-specific remediation using the current canvas and business context", async ({ page }) => {
    await page.route("**/api/ai/review", async (route) => {
      const request = route.request().postDataJSON();
      expect(request.source).toBe("canvas");
      expect(request.payload.nodes.map((node: { id: string }) => node.id)).toEqual(["api", "monitor"]);
      expect(request.context).toContain("four-hour RTO");
      await route.fulfill({
        json: { transport: "foundry-agent", review: {
          ...review,
          findings: review.findings.map((finding) => ({ ...finding, nodeIds: finding.id === "rel-recovery" ? ["api"] : [], edgeIds: [] })),
        } },
      });
    });
    const modal = await prepare(page, true);
    await expect(modal.getByText("Foundry review agent configured", { exact: true })).toBeVisible();
    await modal.getByPlaceholder(/Add business criticality/).fill("Production orders: four-hour RTO, confidential data.");
    await modal.getByRole("button", { name: "Run Foundry review" }).click();
    const result = modal.getByRole("region", { name: "Your personalized review" });
    await expect(result.getByRole("article").first()).toContainText("Test recovery for Orders API");
    await expect(result.getByRole("article").first()).toContainText("Orders API [api]");
    await expect(result.getByRole("article").first()).toContainText("#1");
    await expect(result).toContainText("Your remediation playbook");
    await expect(result).toContainText("Measure recovery time against the agreed target.");
    await expect(result).toContainText("Unknown or unverified evidence");
    await expect(modal.getByTestId("waf-overall-score")).toHaveText("7/100");
    await modal.getByPlaceholder(/Add business criticality/).fill("Recovery target changed to one hour.");
    await expect(modal.getByRole("status").filter({ hasText: "changed since this review" })).toBeVisible();
  });

  test("reviews a description without fabricating diagram evidence or node IDs", async ({ page }) => {
    await page.route("**/api/ai/review", async (route) => {
      const request = route.request().postDataJSON();
      expect(request.source).toBe("description");
      expect(request.description).toContain("two-region");
      expect(request.payload).toBeUndefined();
      await route.fulfill({ json: { transport: "foundry-agent", review } });
    });
    const modal = await prepare(page, true);
    await modal.getByRole("button", { name: "Describe", exact: true }).click();
    await modal.getByPlaceholder(/Explain business criticality/).fill(
      "A two-region Azure application uses Front Door, App Service, Service Bus, and Azure SQL."
    );
    await modal.getByRole("button", { name: "Run Foundry review" }).click();
    await expect(modal.getByText("72", { exact: true })).toBeVisible();
    await expect(modal.getByText("Well-Architected Framework", { exact: true })).toBeVisible();
    await expect(modal.getByText("Azure Landing Zones", { exact: true })).toBeVisible();
    await expect(modal.getByText(/No node-specific evidence supplied/).first()).toBeVisible();
    await expect(modal.getByTestId("waf-diagram-assessment")).toHaveCount(0);
  });

  test("preserves image and customer context for cross-framework Foundry review", async ({ page }) => {
    await page.route("**/api/ai/review", async (route) => {
      const request = route.request().postDataJSON();
      expect(request.source).toBe("image");
      expect(request.context).toContain("four-hour RTO");
      expect(request.image.name).toBe("customer-architecture.png");
      expect(request.image.dataUrl).toMatch(/^data:image\/png;base64,/);
      await route.fulfill({ json: { transport: "foundry-agent", review: {
        ...review,
        findings: [
          ...review.findings,
          { ...review.findings[0], id: "aac", title: "Review asynchronous workload isolation", framework: "Azure Architecture Center", sourceUrl: "https://learn.microsoft.com/azure/architecture/" },
          { ...review.findings[0], id: "caf", title: "Confirm your operating model", framework: "Cloud Adoption Framework", sourceUrl: "https://learn.microsoft.com/azure/cloud-adoption-framework/" },
        ],
      } } });
    });
    const modal = await prepare(page, true);
    await modal.getByRole("button", { name: "Upload diagram" }).click();
    await modal.getByLabel("Upload architecture diagram image").setInputFiles({
      name: "customer-architecture.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAFAAH/q842AAAAAElFTkSuQmCC", "base64"),
    });
    await expect(modal.getByAltText("Architecture diagram preview: customer-architecture.png")).toBeVisible();
    await modal.getByPlaceholder(/Add business criticality/).fill("Production banking, confidential data, four-hour RTO.");
    await modal.getByRole("button", { name: "Run Foundry review" }).click();
    for (const framework of ["Azure Architecture Center", "Azure Landing Zones", "Cloud Adoption Framework", "Well-Architected Framework"]) {
      await expect(modal.getByText(framework, { exact: true })).toBeVisible();
    }
    await expect(modal.getByTestId("waf-diagram-assessment")).toHaveCount(0);
  });

  test("rescoring imported evidence reports removed and restored connections", async ({ page }) => {
    const modal = await prepare(page, false);
    await modal.getByRole("button", { name: "Import JSON" }).click();
    const upload = async (edges: typeof payload.edges) => {
      await modal.getByLabel("Import architecture for review").setInputFiles({
        name: "architecture.json", mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ ...payload, edges })),
      });
    };
    await upload(payload.edges);
    await expect(modal.getByTestId("waf-pillar-operational-excellence")).toContainText("33/100");
    await modal.getByRole("button", { name: "Use current canvas as baseline" }).click();
    await upload([]);
    await expect(modal.getByTestId("waf-pillar-operational-excellence")).toContainText("0/100");
    await expect(modal.getByTestId("waf-assessment-diff")).toContainText("1 lost patterns");
    await expect(modal.getByTestId("waf-assessment-diff")).toContainText("Removed edges: telemetry");
    await upload(payload.edges);
    await expect(modal.getByTestId("waf-assessment-diff")).toContainText("No evidence changes since baseline");
  });

  test("agent runtime failures remain errors while offline evidence stays available", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/ai/review", async (route) => {
      calls += 1;
      await route.fulfill({ status: 503, json: { error: "Foundry agent unavailable. Verify configuration and identity." } });
    });
    const modal = await prepare(page, true);
    await modal.getByRole("button", { name: "Run Foundry review" }).click();
    await expect(modal.getByRole("alert")).toContainText("Foundry agent unavailable");
    await expect(modal.getByRole("region", { name: "Your personalized review" })).toHaveCount(0);
    await expect(modal.getByTestId("waf-overall-score")).toHaveText("7/100");
    expect(calls).toBe(1);
  });

  test("deterministic API returns explicit offline provenance without an agent completion", async ({ request }) => {
    const response = await request.post("/api/ai/review", {
      data: { source: "canvas", assessmentOnly: true, payload: { nodes: [], edges: [] } },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.transport).toBe("offline-deterministic");
    expect(result.review).toBeUndefined();
    expect(Object.keys(result.assessment.pillarScores)).toHaveLength(5);
    expect(result.assessment.score).toBe(0);
  });
});
