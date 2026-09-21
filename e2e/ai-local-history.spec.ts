import { expect, test, type Page } from "@playwright/test";
import { privacyFixture } from "./ai-privacy-fixture";

const HISTORY_KEY = "architecture-playground:ai-history";
const GENERATED_KEY = "architecture-playground:ai-generated";
const generatedGraph = {
  nodes: [{ id: "generated-note", type: "sticky", position: { x: 100, y: 100 }, data: { label: "Synthetic generated candidate" } }],
  edges: [],
};
declare global {
  interface Window {
    __aiHistoryRequests: Array<{ aborted: boolean; release: (failure?: boolean) => void }>;
  }
}

test.use({ viewport: { width: 1500, height: 1100 } });
test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  // Catch every AI endpoint so no browser test can invoke a model.
  await page.route("**/api/ai/**", (route) => {
    const endpoint = new URL(route.request().url()).pathname.split("/").at(-1);
    if (endpoint === "status") return route.fulfill({ json: { configured: true, diagramConfigured: true, reviewAgentConfigured: true } });
    if (endpoint === "privacy") return route.fulfill({ json: privacyFixture });
    if (endpoint === "generate") return route.fulfill({ json: { graph: generatedGraph } });
    if (endpoint === "describe" || endpoint === "review") return route.fulfill({ json: { markdown: `Synthetic ${endpoint} response` } });
    return route.fulfill({ status: 503, json: { error: "Unmocked AI endpoint is blocked in this test." } });
  });
});

async function openPanel(page: Page) {
  await page.getByRole("button", { name: "Toggle AI Assist", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "AI Assist", exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

async function generate(page: Page, prompt: string) {
  const panel = page.getByRole("complementary", { name: "AI Assist", exact: true });
  await panel.getByRole("textbox", { name: "Architecture prompt" }).fill(prompt);
  await panel.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(panel).toContainText("Generated diagram with 1 nodes.");
}

async function aiStorage(page: Page) {
  return page.evaluate(({ history, generated }) => ({
    history: localStorage.getItem(history), generated: sessionStorage.getItem(generated),
  }), { history: HISTORY_KEY, generated: GENERATED_KEY });
}

test("default generation keeps prompt and candidate out of browser storage and discloses retention", async ({ page }) => {
  await page.goto("/legacy-playground");
  let panel = await openPanel(page);
  await expect(panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true })).not.toBeChecked();
  await expect(panel.getByRole("region", { name: "AI privacy: chat" })).toContainText("https://approved-chat.example");
  await expect(panel.getByRole("region", { name: "AI privacy: review" })).toContainText("https://approved-foundry.example");
  await expect(panel).toContainText("cannot erase provider-retained data");
  await expect(panel).toContainText("copies already applied to the canvas");
  await generate(page, "Synthetic private prompt");
  expect(await aiStorage(page)).toEqual({ history: null, generated: null });
  await expect(panel.getByText("Recent prompts", { exact: true })).toHaveCount(0);
  await page.reload();
  panel = await openPanel(page);
  await expect(panel.getByRole("textbox", { name: "Architecture prompt" })).toHaveValue("");
  await expect(panel.getByRole("button", { name: "Apply to canvas", exact: true })).toHaveCount(0);
  expect(await aiStorage(page)).toEqual({ history: null, generated: null });
});

test("legacy prompts stay viewable, opt-in enables bounded history, and reload or unchecking stops new saves", async ({ page }) => {
  await page.goto("/legacy-playground");
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(["Legacy saved prompt"])), HISTORY_KEY);
  await page.reload();
  let panel = await openPanel(page);
  let consent = panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true });
  await expect(consent).not.toBeChecked();
  await panel.getByText("Recent prompts", { exact: true }).click();
  await expect(panel.getByRole("button", { name: "Legacy saved prompt", exact: true })).toBeVisible();
  await generate(page, "Do not remember this");
  expect((await aiStorage(page)).history).toBe('["Legacy saved prompt"]');
  await consent.check();
  await generate(page, "Explicitly remembered prompt");
  const saved = '["Explicitly remembered prompt","Legacy saved prompt"]';
  expect((await aiStorage(page)).history).toBe(saved);
  await consent.uncheck();
  await generate(page, "Stopped remembering");
  expect((await aiStorage(page)).history).toBe(saved);
  await page.reload();
  panel = await openPanel(page);
  consent = panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true });
  await expect(consent).not.toBeChecked();
  await panel.getByText("Recent prompts", { exact: true }).click();
  await expect(panel.getByRole("button", { name: "Explicitly remembered prompt", exact: true })).toBeVisible();
  await generate(page, "Still not remembered after reload");
  expect((await aiStorage(page)).history).toBe(saved);
});

test("clear removes only AI keys and panel state, preserving canvas copies and every unrelated storage entry", async ({ page }) => {
  await page.goto("/legacy-playground");
  const panel = await openPanel(page);
  await panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true }).check();
  await generate(page, "Opted-in synthetic architecture");
  await panel.getByRole("button", { name: "Apply to canvas", exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id="generated-note"]')).toHaveCount(1);
  await expect(panel).toContainText("Applied to canvas.");
  await generate(page, "Second memory-only candidate");
  await page.evaluate(({ generated }) => {
    sessionStorage.setItem(generated, '{"legacy":"parked candidate"}');
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem("architecture-playground:test-diagram", '{"nodes":["saved diagram"]}');
      storage.setItem("architecture-playground:test-comments", '{"comments":["keep me"]}');
      storage.setItem("architecture-playground:test-versions", '{"versions":["keep me"]}');
      storage.setItem("unrelated:test-key", "preserve exactly");
    }
  }, { generated: GENERATED_KEY });
  // Let existing canvas autosave finish before comparing all non-AI keys.
  await expect.poll(() => page.evaluate(() => Object.values(localStorage).some((value) => value.includes('"generated-note"')))).toBe(true);
  const preserved = () => page.evaluate(({ history, generated }) => {
    const withoutAiKeys = (storage: Storage) => Object.fromEntries(
      Object.entries(storage).filter(([key]) => key !== history && key !== generated),
    );
    return { local: withoutAiKeys(localStorage), session: withoutAiKeys(sessionStorage) };
  }, { history: HISTORY_KEY, generated: GENERATED_KEY });
  const before = await preserved();
  await panel.getByRole("button", { name: "Clear AI session", exact: true }).click();
  expect(await aiStorage(page)).toEqual({ history: null, generated: null });
  expect(await preserved()).toEqual(before);
  await expect(panel.getByRole("textbox", { name: "Architecture prompt" })).toHaveValue("");
  await expect(panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true })).not.toBeChecked();
  await expect(panel.getByText("Recent prompts", { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Apply to canvas", exact: true })).toHaveCount(0);
  await expect(panel.locator("pre")).toHaveCount(0);
  await expect(page.locator('.react-flow__node[data-id="generated-note"]')).toHaveCount(1);
  await page.reload();
  const reopened = await openPanel(page);
  await expect(reopened.getByText("Recent prompts", { exact: true })).toHaveCount(0);
  await expect(page.locator('.react-flow__node[data-id="generated-note"]')).toHaveCount(1);
});

test("Apply uses the current in-memory candidate, not a legacy session value, and describe/review still work", async ({ page }) => {
  await page.goto("/legacy-playground");
  const panel = await openPanel(page);
  await page.evaluate((key) => sessionStorage.setItem(key, "{malformed old parked candidate"), GENERATED_KEY);
  await generate(page, "Generate an in-memory candidate");
  await panel.getByRole("button", { name: "Apply to canvas", exact: true }).click();
  await expect(panel).toContainText("Applied to canvas.");
  await expect(page.locator('.react-flow__node[data-id="generated-note"]')).toHaveCount(1);
  expect((await aiStorage(page)).generated).toBe("{malformed old parked candidate");
  await panel.getByRole("button", { name: "Describe", exact: true }).click();
  await expect(panel.locator("pre")).toHaveText("Synthetic describe response");
  await panel.getByRole("button", { name: "Review", exact: true }).click();
  await expect(panel.locator("pre")).toHaveText("Synthetic review response");
  expect((await aiStorage(page)).history).toBeNull();
});

test("canonical Apply failures remain visible and preserve the existing canvas", async ({ page }) => {
  await page.goto("/legacy-playground");
  const panel = await openPanel(page);
  await generate(page, "Generate initial safe candidate");
  await panel.getByRole("button", { name: "Apply to canvas", exact: true }).click();
  await page.route("**/api/ai/generate", (route) => route.fulfill({ json: { graph: {
    nodes: [{ id: "unresolved", type: "service", position: { x: 0, y: 0 }, data: { iconId: "aws/compute/key-vault", cloud: "aws", label: "Invalid service identity" } }],
    edges: [],
  } } }));
  await generate(page, "Generate unresolved synthetic identity");
  await panel.getByRole("button", { name: "Apply to canvas", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Your current diagram is unchanged.");
  await expect(panel).not.toContainText("Applied to canvas.");
  await expect(page.locator('.react-flow__node[data-id="generated-note"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__node[data-id="unresolved"]')).toHaveCount(0);
});

test("malformed saved history is reported and preserved until deliberate clear", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '["old prompt", {"invalid":true}]'), HISTORY_KEY);
  await page.goto("/legacy-playground");
  const panel = await openPanel(page);
  await expect(panel.getByRole("alert")).toContainText("Saved AI prompt history is malformed");
  await expect(panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true })).toBeDisabled();
  await generate(page, "Generation still works without saving");
  expect((await aiStorage(page)).history).toBe('["old prompt", {"invalid":true}]');
  await panel.getByRole("button", { name: "Clear AI session", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true })).toBeEnabled();
  expect((await aiStorage(page)).history).toBeNull();
});

test("write and clear storage failures are surfaced while memory and requests still clear", async ({ page }) => {
  await page.addInitScript(({ history, generated }) => {
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    setItem.call(window.sessionStorage, generated, "Legacy candidate");
    Storage.prototype.setItem = function (key, value) {
      if (key === history) throw new DOMException("Synthetic quota exceeded", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (key === generated) throw new DOMException("Synthetic removal denied", "SecurityError");
      return removeItem.call(this, key);
    };
  }, { history: HISTORY_KEY, generated: GENERATED_KEY });
  await page.goto("/legacy-playground");
  const panel = await openPanel(page);
  await panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true }).check();
  await generate(page, "Prompt whose save fails");
  await expect(panel.getByRole("alert")).toContainText("Synthetic quota exceeded");
  expect((await aiStorage(page)).history).toBeNull();
  await panel.getByRole("button", { name: "Clear AI session", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Synthetic removal denied");
  await expect(panel.getByRole("textbox", { name: "Architecture prompt" })).toHaveValue("");
  await expect(panel.locator("pre")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Apply to canvas", exact: true })).toHaveCount(0);
  expect((await aiStorage(page)).generated).toBe("Legacy candidate");
});

for (const action of ["clear", "close", "toggle closed"] as const) {
  test(`${action} aborts pending generation and ignores late responses even when the transport ignores abort`, async ({ page }) => {
    await page.addInitScript((graph) => {
      const nativeFetch = window.fetch.bind(window);
      const requests: Window["__aiHistoryRequests"] = [];
      window.__aiHistoryRequests = requests;
      window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (!url.endsWith("/api/ai/generate")) return nativeFetch(input, init);
        return new Promise<Response>((resolve) => {
          const pending = {
            aborted: !!init?.signal?.aborted,
            release: (failure = false) => resolve(new Response(JSON.stringify(failure
              ? { error: "Late synthetic failure" } : { graph }), { status: failure ? 500 : 200, headers: { "Content-Type": "application/json" } })),
          };
          init?.signal?.addEventListener("abort", () => { pending.aborted = true; });
          requests.push(pending);
        });
      };
    }, generatedGraph);
    await page.goto("/legacy-playground");
    let panel = await openPanel(page);
    await panel.getByRole("checkbox", { name: "Remember prompts on this device", exact: true }).check();
    await panel.getByRole("textbox", { name: "Architecture prompt" }).fill("Pending synthetic prompt");
    await panel.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__aiHistoryRequests.length)).toBe(1);
    if (action === "clear") {
      await panel.getByRole("button", { name: "Clear AI session", exact: true }).click();
    } else {
      if (action === "close") await panel.getByRole("button", { name: "Close AI Assist", exact: true }).click();
      else await page.getByRole("button", { name: "Toggle AI Assist", exact: true }).click();
      await expect(panel).toHaveCount(0);
      panel = await openPanel(page);
    }
    await expect.poll(() => page.evaluate(() => window.__aiHistoryRequests[0].aborted)).toBe(true);
    const retainedAfterCancel = await aiStorage(page);
    if (action === "clear") expect(retainedAfterCancel).toEqual({ history: null, generated: null });
    await page.evaluate(async (failure) => {
      window.__aiHistoryRequests[0].release(failure);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, action === "close");
    await expect(panel.locator("pre")).toHaveCount(0);
    await expect(panel.getByRole("alert")).toHaveCount(0);
    expect(await aiStorage(page)).toEqual(retainedAfterCancel);
    await panel.getByRole("textbox", { name: "Architecture prompt" }).fill("Fresh generation after cancellation");
    await expect(panel.getByRole("button", { name: "Generate", exact: true })).toBeEnabled();
    await panel.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__aiHistoryRequests.length)).toBe(2);
    await page.evaluate(() => window.__aiHistoryRequests[1].release());
    await expect(panel).toContainText("Generated diagram with 1 nodes.");
    expect((await aiStorage(page)).generated).toBeNull();
    if (action === "clear") expect((await aiStorage(page)).history).toBeNull();
  });
}
