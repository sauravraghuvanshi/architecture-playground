import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const expectedTemplateIcons: Record<string, string | null> = JSON.parse(readFileSync(
  path.join(process.cwd(), "scripts", "fixtures", "template-icon-identities.json"), "utf8",
));
const catalog: { icons: Array<{ id: string; path: string }> } = JSON.parse(readFileSync(
  path.join(process.cwd(), "content", "cloud-icons.json"), "utf8",
));
const iconsById = new Map(catalog.icons.map((icon) => [icon.id, icon]));
interface TemplateNode {
  id: string;
  type: string;
  data: { iconId?: string; label: string };
}

async function expectTemplateIdentities(page: Page, nodes: TemplateNode[]) {
  const services = nodes.filter((node) => node.type === "service");
  for (const service of services) {
    const legacyId = service.data.iconId ?? "";
    expect(Object.hasOwn(expectedTemplateIcons, legacyId), `Audited identity: ${legacyId}`).toBe(true);
    const canonicalId = expectedTemplateIcons[legacyId];
    const node = page.locator(`.react-flow__node[data-id="${service.id}"]`);
    await expect(node).toContainText(service.data.label);
    if (canonicalId === null) {
      await expect(node, `No bundled product icon for ${legacyId}`).toHaveClass(/react-flow__node-shape/);
      await expect(node.locator("img")).toHaveCount(0);
    } else {
      await expect(node).toHaveClass(/react-flow__node-icon/);
      const canonical = iconsById.get(canonicalId);
      expect(canonical, `Bundled canonical asset for ${legacyId}`).toBeDefined();
      await expect(node.locator("img")).toHaveAttribute("src", canonical!.path);
    }
  }
  const iconCount = services.filter((node) => expectedTemplateIcons[node.data.iconId ?? ""] !== null).length;
  await expect(page.locator(".react-flow__node-icon")).toHaveCount(iconCount);
  await expect(page.locator(".react-flow__node-shape")).toHaveCount(services.length - iconCount);
}

function readTemplate(id: string): { graph: { nodes: TemplateNode[] } } {
  return JSON.parse(readFileSync(path.join(process.cwd(), "content", "playground-templates", `${id}.json`), "utf8"));
}

async function importGalleryTemplate(page: Page, name: RegExp): Promise<Page> {
  await page.goto("/templates");
  await page.getByRole("button", { name }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const [workspace] = await Promise.all([
    page.context().waitForEvent("page"),
    page.getByRole("button", { name: "Use this template" }).click(),
  ]);
  await workspace.waitForLoadState("domcontentloaded");
  await expect(workspace.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });
  return workspace;
}

async function expectLoadedIcons(page: Page) {
  const images = page.locator(".react-flow__node-icon img");
  expect(await images.count()).toBeGreaterThan(0);
  await expect.poll(() => images.evaluateAll((elements) =>
    elements.every((element) => {
      const image = element as HTMLImageElement;
      return image.complete && image.naturalWidth > 0;
    })
  ), { timeout: 15_000 }).toBe(true);
}

test.describe("Template gallery imports", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test("imports the 3-tier Azure template with correct icons and geometry", async ({ page }) => {
    const workspace = await importGalleryTemplate(page, /3-Tier on Azure/);
    await expect(workspace.locator(".react-flow__node-icon")).toHaveCount(6);
    await expect(workspace.locator(".react-flow__edge")).toHaveCount(5);
    await expectTemplateIdentities(workspace, readTemplate("3-tier-azure").graph.nodes);
    await expectLoadedIcons(workspace);

    const positions = await workspace.locator(".react-flow__node-icon").evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return `${Math.round(rect.x)}:${Math.round(rect.y)}`;
      })
    );
    expect(new Set(positions).size).toBe(positions.length);
  });

  test("imports grouped multi-cloud nodes inside their provider boundaries", async ({ page }) => {
    const workspace = await importGalleryTemplate(page, /Multi-cloud Data Pipeline/);
    await expect(workspace.locator(".react-flow__node-group")).toHaveCount(3);
    // API Gateway and Pub/Sub have no product assets in this bundled catalog.
    // Keep them explicit primitives rather than unrelated Cloud Control API or integration icons.
    await expect(workspace.locator(".react-flow__node-icon")).toHaveCount(4);
    await expect(workspace.locator(".react-flow__node-shape")).toHaveCount(2);
    await expect(workspace.locator(".react-flow__edge")).toHaveCount(5);
    await expectTemplateIdentities(workspace, readTemplate("multi-cloud-data").graph.nodes);
    await expectLoadedIcons(workspace);

    const containment = await workspace.evaluate(() => {
      const parentIds = ["awsg", "azg", "gcpg"];
      return parentIds.every((parentId) => {
        const parent = document.querySelector<HTMLElement>(
          `.react-flow__node[data-id="${parentId}"]`
        );
        if (!parent) return false;
        const parentRect = parent.getBoundingClientRect();
        const children = Array.from(
          document.querySelectorAll<HTMLElement>(
            `.react-flow__node[data-nodeid][data-id]`
          )
        ).filter((node) => node.getAttribute("data-nodeid") === parentId);
        if (!children.length) {
          const knownChildren = {
            awsg: ["agw", "lambda"],
            azg: ["sb", "func"],
            gcpg: ["pubsub", "bq"],
          }[parentId as "awsg" | "azg" | "gcpg"];
          return knownChildren.every((id) => {
            const child = document.querySelector<HTMLElement>(
              `.react-flow__node[data-id="${id}"]`
            );
            if (!child) return false;
            const rect = child.getBoundingClientRect();
            return (
              rect.left >= parentRect.left &&
              rect.right <= parentRect.right &&
              rect.top >= parentRect.top &&
              rect.bottom <= parentRect.bottom
            );
          });
        }
        return children.every((child) => {
          const rect = child.getBoundingClientRect();
          return (
            rect.left >= parentRect.left &&
            rect.right <= parentRect.right &&
            rect.top >= parentRect.top &&
            rect.bottom <= parentRect.bottom
          );
        });
      });
    });
    expect(containment).toBe(true);
  });

  test("all architecture templates preserve node and edge shape", async ({ page }) => {
    test.setTimeout(180_000);
    const templatesDir = path.join(process.cwd(), "content", "playground-templates");
    const templates = readdirSync(templatesDir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) =>
        JSON.parse(readFileSync(path.join(templatesDir, file), "utf8")) as {
          id: string;
          graph: { nodes: TemplateNode[]; edges: unknown[] };
        }
      );

    await page.goto("/");
    const workspace = await page.context().newPage();
    for (const template of templates) {
      const handoffId = `e2e_${template.id}`;
      await page.evaluate(
        ({ key, payload }) => localStorage.setItem(key, JSON.stringify(payload)),
        {
          key: `architecture-playground:template-handoff:${handoffId}`,
          payload: { id: template.id, graph: template.graph, savedAt: new Date().toISOString() },
        }
      );
      await workspace.goto(`/diagrammatic?templateHandoff=${handoffId}`);
      await expect(workspace.locator(".react-flow__node"), `${template.id} node shape`).toHaveCount(
        template.graph.nodes.length,
        { timeout: 30_000 }
      );
      await expect(workspace.locator(".react-flow__edge"), `${template.id} edge shape`).toHaveCount(
        template.graph.edges.length
      );
      await expectTemplateIdentities(workspace, template.graph.nodes);
      await expectLoadedIcons(workspace);
    }
    await workspace.close();
  });
});
