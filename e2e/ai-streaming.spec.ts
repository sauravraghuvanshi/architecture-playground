import { expect, test, type Page } from "@playwright/test";
import { privacyFixture } from "./ai-privacy-fixture";
import { readCanvasPayload } from "./read-canvas-payload";

const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgqLjyHwAEFAJMURtfXQAAAABJRU5ErkJggg==";
const result = { type: "result", b64, mimeType: "image/png", size: "1024x1024" };
const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;

async function openImage(page: Page) {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { imageConfigured: true, diagramConfigured: false } }));
  await page.route("**/api/ai/privacy", (route) => route.fulfill({ json: privacyFixture }));
  await page.goto("/diagrammatic?mode=whiteboard");
  await expect(page.locator(".excalidraw").first()).toBeVisible();
  await page.getByRole("button", { name: "AI Assist", exact: true }).click();
  await page.getByLabel("Describe the image to generate").fill("Synthetic image stream fixture");
}

async function imageCount(page: Page) {
  const payload = await readCanvasPayload(page, "whiteboard");
  if (!payload || typeof payload !== "object" || !("elements" in payload) || !Array.isArray(payload.elements)) return 0;
  return payload.elements.filter((element) => element.type === "image" && !element.isDeleted).length;
}

test("CRLF-framed image result inserts once and remains undoable", async ({ page }) => {
  await page.route("**/api/ai/image", (route) => route.fulfill({
    contentType: "text/event-stream", body: (event({ type: "started" }) + event(result)).replaceAll("\n", "\r\n"),
  }));
  await openImage(page);
  await page.getByRole("button", { name: "Generate image", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "AI Assist", exact: true })).toHaveCount(0);
  await expect.poll(() => imageCount(page)).toBe(1);
  await page.locator(".diagrammatic-whiteboard").getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => imageCount(page)).toBe(0);
});

for (const [name, body, expected] of [
  ["duplicate result", event(result) + event(result), /more than one terminal/],
  ["error after result", event(result) + event({ type: "error", status: 429 }), /more than one terminal/],
  ["truncated event", event(result).trimEnd(), /truncated/],
  ["invalid JSON", "data: {broken}\n\n" + event(result), /invalid JSON/],
  ["URL-only result", event({ type: "result", url: "https://external.invalid/image.png" }), /invalid image/],
  ["refusal", event({ type: "error", code: "refused", status: 400, message: "PRIVATE_PROVIDER_DETAIL" }), /content policy/],
  ["throttle", event({ type: "error", code: "throttled", status: 429 }), /throttled/],
] as const) {
  test(`${name} is explicit and leaves Whiteboard unchanged`, async ({ page }) => {
    await page.route("**/api/ai/image", (route) => route.fulfill({ contentType: "text/event-stream", body }));
    await openImage(page);
    await page.getByRole("button", { name: "Generate image", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "AI Assist", exact: true });
    await expect(dialog.getByText(expected)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Generate image", exact: true })).toBeEnabled();
    expect(await imageCount(page)).toBe(0);
    await expect(dialog.getByText("PRIVATE_PROVIDER_DETAIL")).toHaveCount(0);
  });
}

test("clearing while final image pixels decode prevents a late canvas insertion", async ({ page }) => {
  await page.route("**/api/ai/image", (route) => route.fulfill({ contentType: "text/event-stream", body: event(result) }));
  await openImage(page);
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function() {
      await decode.call(this);
      if (!this.src.startsWith("data:image/png;base64,")) return;
      await new Promise<void>((resolve) => Object.defineProperty(window, "finishImageDecode", { configurable: true, value: resolve }));
    };
  });
  await page.getByRole("button", { name: "Generate image", exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, "finishImageDecode"))).toBe("function");
  await page.getByRole("button", { name: "Clear AI session", exact: true }).click();
  await page.evaluate(() => {
    const finish: unknown = Reflect.get(window, "finishImageDecode");
    if (typeof finish !== "function") throw new Error("No pending image decode");
    finish();
  });
  await expect(page.getByLabel("Describe the image to generate")).toHaveValue("");
  await expect.poll(() => imageCount(page)).toBe(0);
  await expect(page.getByRole("dialog", { name: "AI Assist", exact: true })).toBeVisible();
});

test("clear cancels a silent pending stream even if its transport ignores the abort signal", async ({ page }) => {
  await openImage(page);
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (!String(input).endsWith("/api/ai/image")) return original(input, init);
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"started"}\n\n')); },
        cancel() { Object.defineProperty(window, "imageStreamCancelled", { configurable: true, value: true }); },
      }), { headers: { "content-type": "text/event-stream" } });
    };
  });
  await page.getByRole("button", { name: "Generate image", exact: true }).click();
  await expect(page.getByText(/Generating image.*elapsed/)).toBeVisible();
  await page.getByRole("button", { name: "Clear AI session", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "imageStreamCancelled"))).toBe(true);
  expect(await imageCount(page)).toBe(0);
  await expect(page.getByLabel("Describe the image to generate")).toHaveValue("");
});
