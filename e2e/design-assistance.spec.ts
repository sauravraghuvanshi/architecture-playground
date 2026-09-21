import { expect, test } from "@playwright/test";
import manifest from "../content/cloud-icons.json";
import { readSavedDiagram } from "./read-saved-diagram";

test("guided Azure prompt persists proposed design checkpoints without an LLM", async ({ page }) => {
  await page.goto(`/diagrammatic?prompt=${encodeURIComponent("Secure production Azure customer portal")}`);
  await expect(page.locator(".react-flow__node").filter({ hasText: "Guided draft - not deployed" })).toBeVisible();
  await expect(page.locator(".react-flow__node").filter({ hasText: "Reliability and recovery" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("diagrammatic.draft") ?? "{}");
    return draft.payload?.nodes?.some((node: { id: string }) => node.id === "g_design_guidance") ?? false;
  }), { timeout: 15_000 }).toBe(true);
  await page.goto("/diagrammatic");
  await expect(page.locator(".react-flow__node").filter({ hasText: "Guided draft - not deployed" })).toBeVisible();
});

test("guided AI generation captures constraints, previews advice and preserves operational edges", async ({ page }) => {
  const icon = manifest.icons.find((candidate) => candidate.cloud === "azure");
  if (!icon) throw new Error("Azure icon manifest is unavailable");
  const graph = {
    metadata: { name: "Guided proposal", description: "Test design" },
    nodes: ["app", "ops"].map((id, index) => ({
      id, type: "service", position: { x: index * 300, y: 50 },
      data: { iconId: icon.id, cloud: "azure", label: id === "app" ? "Customer application" : "Operational dependency" },
    })),
    edges: [{ id: "operations", source: "app", target: "ops",
      data: { label: "Telemetry", connectionType: "data-flow", lineStyle: "dashed", arrowStyle: "forward" } }],
  };
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { diagramConfigured: true, imageConfigured: false } }));
  await page.route("**/api/ai/generate", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { graph, mode: "architecture", designAssistance: {
      assumptions: ["Customer owns the recovery target."],
      recommendations: ["Use private connectivity for the data path."],
      tradeoffs: ["Additional resilience increases cost."],
      nextSteps: ["Validate recovery with the workload owner."],
    } } });
  });
  await page.goto("/diagrammatic");
  await expect(page.getByRole("button", { name: "Templates", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Toggle Microsoft CSA guidance" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review my architecture" })).toBeVisible();
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "AI Assist", exact: true });
  await dialog.getByLabel("Describe what to build").fill("Azure customer application with operational monitoring");
  await dialog.getByText("Business constraints (optional)", { exact: true }).click();
  await dialog.getByLabel("Budget", { exact: true }).fill("$500 per month");
  await dialog.getByLabel("RTO / RPO", { exact: true }).fill("RTO 1 hour, RPO 15 minutes");
  await dialog.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Guided design preview" })).toBeVisible();
  expect(submitted?.businessConstraints).toEqual({ budget: "$500 per month", recovery: "RTO 1 hour, RPO 15 minutes" });
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.evaluate(() => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      const request = originalOpen(...args);
      const setter = Object.getOwnPropertyDescriptor(IDBRequest.prototype, "onsuccess")?.set;
      if (!setter) throw new Error("Missing IndexedDB event setter");
      Object.defineProperty(request, "onsuccess", {
        set(handler: (event: Event) => void) {
          setter.call(request, (event: Event) => {
            Object.defineProperty(window, "finishDesignSave", { configurable: true, value: () => handler.call(request, event) });
          });
        },
      });
      indexedDB.open = originalOpen;
      return request;
    };
  });
  await dialog.getByRole("button", { name: "Apply generated design" }).click();
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Clear AI session", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("status")).toContainText("committed action");
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, "finishDesignSave"))).toBe("function");
  await page.evaluate(() => {
    const finish: unknown = Reflect.get(window, "finishDesignSave");
    if (typeof finish !== "function") throw new Error("No pending design save");
    finish();
    Reflect.deleteProperty(window, "finishDesignSave");
  });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect.poll(async () => {
    const payload = (await readSavedDiagram(page, "AI design proposal"))?.payload;
    return payload && typeof payload === "object" && "edges" in payload && Array.isArray(payload.edges) ? payload.edges[0]?.style : undefined;
  }).toBe("dashed");
});

test("explicit AWS template stays AWS rather than receiving Azure scaffolding", async ({ page }) => {
  await page.goto("/diagrammatic?template=aws-serverless-images");
  await expect(page.locator(".react-flow__node").filter({ hasText: "Lambda" }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("diagrammatic.draft") ?? "{}");
    const services = draft.payload?.nodes?.filter((node: { iconId?: string }) => node.iconId) ?? [];
    return services.length > 0 && services.every((node: { iconId: string }) => node.iconId.startsWith("aws/"));
  }), { timeout: 15_000 }).toBe(true);
  await expect(page.locator(".react-flow__node").filter({ hasText: "Guided draft - not deployed" })).toHaveCount(0);
});
