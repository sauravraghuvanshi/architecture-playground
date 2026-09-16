import { expect, test, type Download } from "@playwright/test";

const modes = ["architecture", "flowchart", "mindmap", "sequence", "er", "uml", "c4", "whiteboard", "kanban"] as const;

async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Export download was not readable.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

for (const mode of modes) {
  test(`${mode} exports every advertised static and text format as the correct artifact`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/diagrammatic?mode=${mode}`);
    if (mode === "architecture") {
      await page.getByRole("button", { name: "Component", exact: true }).click();
      await expect(page.locator(".react-flow__node")).toHaveCount(1);
    } else if (mode === "whiteboard") {
      await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 30_000 });
      await page.locator('button[title^="Click or drag to insert"]').first().click();
    } else if (mode === "kanban") {
      await expect(page.getByText("Onboarding flow", { exact: true })).toBeVisible({ timeout: 30_000 });
    } else {
      await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 30_000 });
    }

    const formats = mode === "kanban" ? ["png", "md"] : [
      "png", "svg", "pdf", "json", ...(mode === "er" ? ["sql"] : mode === "uml" ? ["ts"] : []),
    ];
    const labels: Record<string, RegExp> = {
      png: /^PNG/, svg: /^SVG/, pdf: /^PDF/, json: /^JSON/,
      sql: /^SQL DDL$/, ts: /^TypeScript$/, md: /^Markdown$/,
    };
    for (const format of formats) {
      await test.step(`download and inspect ${format}`, async () => {
        await page.getByRole("button", { name: "Export", exact: true }).click();
        const downloaded = page.waitForEvent("download", { timeout: 45_000 });
        await page.getByRole("button", { name: labels[format] }).click();
        const download = await downloaded;
        expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
        const bytes = await readDownload(download);
        expect(bytes.length).toBeGreaterThan(10);
        if (format === "png") {
          expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
          expect(bytes.readUInt32BE(16)).toBeGreaterThan(0);
          expect(bytes.readUInt32BE(20)).toBeGreaterThan(0);
        } else if (format === "pdf") {
          expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
          expect(bytes.toString("latin1")).toContain("%%EOF");
        } else if (format === "svg") {
          const validity = await page.evaluate((text) => {
            const document = new DOMParser().parseFromString(text, "image/svg+xml");
            return {
              root: document.documentElement.localName,
              errors: document.querySelectorAll("parsererror").length,
              details: document.querySelector("parsererror")?.textContent ?? "",
            };
          }, bytes.toString());
          expect(validity, validity.details).toEqual({ root: "svg", errors: 0, details: "" });
        } else if (format === "json") {
          const payload = JSON.parse(bytes.toString());
          expect(payload).toBeTruthy();
          expect(Object.values(payload).some((value) => Array.isArray(value) && value.length > 0)).toBe(true);
        } else if (format === "sql") {
          expect(bytes.toString()).toMatch(/CREATE TABLE/i);
        } else if (format === "ts") {
          expect(bytes.toString()).toMatch(/(?:class|interface) \w+/);
        } else {
          expect(bytes.toString()).toMatch(/Backlog|Onboarding flow/);
        }
      });
    }
  });
}
