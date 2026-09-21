import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import ts from "typescript";
import { privacyFixture } from "./ai-privacy-fixture";
import { waitForWorkspace } from "./wait-for-workspace";

const architecture = {
  nodes: [{ kind: "icon", id: "app", label: "Customer application", x: 80, y: 80,
    iconId: "azure/application/application-service", iconPath: "/cloud-icons/azure/application/application-service.svg" }],
  edges: [],
};
const proposal = {
  graph: {
    metadata: { name: "Mock accessibility proposal", description: "No live inference." },
    nodes: [{ id: "proposal", type: "service", position: { x: 80, y: 80 },
      data: { iconId: "azure/application/application-service", cloud: "azure", label: "Proposed application" } }],
    edges: [],
  },
  designAssistance: {
    assumptions: ["Test fixture only."], recommendations: ["Review the proposal."],
    tradeoffs: ["No deployment was performed."], nextSteps: ["Confirm with the owner."],
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((payload) => {
    localStorage.setItem("diagrammatic.draft", JSON.stringify({ mode: "architecture", payload }));
  }, architecture);
  // Every provider path is intercepted: these journeys never use live inference.
  await page.route("**/api/ai/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/privacy")) return route.fulfill({ json: privacyFixture });
    if (path.endsWith("/status")) return route.fulfill({ json: {
      configured: true, diagramConfigured: true, imageConfigured: true,
      reviewAgentConfigured: true, deploymentAgentConfigured: true,
    } });
    return route.fulfill({ status: 503, json: { error: "Mock provider: no live inference." } });
  });
});

async function studio(page: Page) {
  await page.goto("/diagrammatic");
  await waitForWorkspace(page);
}

async function openByKeyboard(page: Page, triggerName: string, dialogName = triggerName) {
  const trigger = page.getByRole("button", { name: triggerName, exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: dialogName, exact: true });
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

async function expectFocusInside(dialog: Locator) {
  await expect.poll(() => dialog.evaluate((element) => ({
    contained: element.contains(document.activeElement),
    active: document.activeElement?.outerHTML.slice(0, 200),
    inertAncestor: element.closest("[inert]")?.outerHTML.slice(0, 200) ?? null,
  }))).toMatchObject({ contained: true });
}

async function expectCycle(page: Page, dialog: Locator) {
  await expectFocusInside(dialog);
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    await expectFocusInside(dialog);
  }
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Shift+Tab");
    await expectFocusInside(dialog);
  }
}

async function holdNextSave(page: Page) {
  await page.evaluate(() => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      const request = originalOpen(...args);
      const setter = Object.getOwnPropertyDescriptor(IDBRequest.prototype, "onsuccess")?.set;
      if (!setter) throw new Error("Missing IndexedDB event setter");
      Object.defineProperty(request, "onsuccess", {
        set(handler: (event: Event) => void) {
          setter.call(request, (event: Event) => {
            Reflect.set(window, "finishDialogSave", () => handler.call(request, event));
          });
        },
      });
      indexedDB.open = originalOpen;
      return request;
    };
  });
}

async function finishSave(page: Page) {
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, "finishDialogSave"))).toBe("function");
  await page.evaluate(() => {
    const finish: unknown = Reflect.get(window, "finishDialogSave");
    if (typeof finish !== "function") throw new Error("No held save");
    finish();
    Reflect.deleteProperty(window, "finishDialogSave");
  });
}

for (const [triggerName, dialogName, initial] of [
  ["AI Assist", "AI Assist", "prompt"],
  ["Review my architecture", "Review my architecture", "Close architecture review"],
  ["Deploy architecture to Azure", "Deploy architecture to Azure", "Close Azure deployment"],
  ["My diagrams", "Saved diagrams", "library"],
] as const) {
  test(`${dialogName}: initial focus, native Tab trapping, Escape and invoking-element restoration`, async ({ page }) => {
    await studio(page);
    const { trigger, dialog } = await openByKeyboard(page, triggerName, dialogName);
    if (initial === "prompt") await expect(dialog.getByLabel("Describe what to build")).toBeFocused();
    else if (initial === "library") await expect(dialog.getByRole("button", { name: "Close diagram library" })).toBeEnabled();
    else await expect(dialog.getByRole("button", { name: initial, exact: true })).toBeFocused();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expectCycle(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test("command palette and help transfer modal ownership and restore the original invoker", async ({ page }) => {
  await studio(page);
  const trigger = page.getByRole("button", { name: "AI Assist", exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Control+k");
  const commands = page.getByRole("dialog", { name: "Command palette", exact: true });
  await expect(commands.getByRole("textbox", { name: "Search commands" })).toBeFocused();
  await expectCycle(page, commands);
  await commands.getByRole("textbox", { name: "Search commands" }).fill("Keyboard shortcuts");
  await page.keyboard.press("Enter");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true });
  await expect(help.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await expect(commands).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(help.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(help.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the trap skips disabled, hidden, inert and collapsed controls and handles zero candidates", async ({ page }) => {
  await studio(page);
  const { dialog, trigger } = await openByKeyboard(page, "AI Assist");
  await dialog.evaluate((element) => {
    const probes = document.createElement("div");
    probes.id = "focus-probes";
    probes.innerHTML = `
      <button disabled>Disabled probe</button>
      <button aria-disabled="true">ARIA disabled probe</button>
      <fieldset disabled><button>Disabled fieldset probe</button></fieldset>
      <button style="display:none">Display probe</button>
      <button style="visibility:hidden">Visibility probe</button>
      <button style="opacity:0">Transparent probe</button>
      <button hidden>Hidden probe</button>
      <div aria-hidden="true"><button>ARIA hidden probe</button></div>
      <div inert><button>Inert probe</button></div>
      <details><summary>Collapsed probe</summary><button>Collapsed child probe</button></details>
      <button tabindex="-1">Negative tab index probe</button>
      <a href="#focus-probes">Visible link probe</a>
      <select aria-label="Visible select probe"><option>Visible option</option></select>`;
    element.append(probes);
  });
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  const link = dialog.getByRole("link", { name: "Visible link probe" });
  const select = dialog.getByRole("combobox", { name: "Visible select probe" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByText("Collapsed probe", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(select).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(select).toBeFocused();
  await select.evaluate((element) => { (element as HTMLSelectElement).disabled = true; });
  await page.keyboard.press("Shift+Tab");
  await expect(link).toBeFocused();
  await dialog.evaluate((element) => {
    for (const child of element.children) (child as HTMLElement).inert = true;
    (element as HTMLElement).focus();
  });
  await page.keyboard.press("Tab");
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("only the visually topmost dialog handles Escape and a lower palette cannot steal focus", async ({ page }) => {
  await studio(page);
  const { dialog: ai, trigger } = await openByKeyboard(page, "AI Assist");
  // Simulate a second overlay opened by an application callback, not pointer input
  // through a backdrop. The existing AI prompt must keep its draft and invoker.
  await page.getByRole("button", { name: "Review my architecture", exact: true }).evaluate((element) => (element as HTMLButtonElement).click());
  const review = page.getByRole("dialog", { name: "Review my architecture", exact: true });
  await expect(review).toBeVisible();
  await expect(ai).toHaveCount(0);
  const hiddenAi = page.getByRole("dialog", { name: "AI Assist", exact: true, includeHidden: true });
  await expect(hiddenAi).toHaveAttribute("aria-modal", "false");
  await expect(hiddenAi).toHaveAttribute("inert", "");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toHaveCount(0);
  await expectCycle(page, review);
  await page.keyboard.press("Escape");
  await expect(review).toHaveCount(0);
  await expect(ai.getByLabel("Describe what to build")).toBeFocused();
  await expect(ai).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(ai).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Escape cancels generation and ignores a late mocked AI response", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/ai/generate", async (route) => {
    await held;
    await route.fulfill({ json: proposal });
  });
  await studio(page);
  const { dialog, trigger } = await openByKeyboard(page, "AI Assist");
  await dialog.getByLabel("Describe what to build").fill("A mocked application");
  const requested = page.waitForRequest("**/api/ai/generate");
  await dialog.getByRole("button", { name: "Generate", exact: true }).click();
  await requested;
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  release();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("region", { name: "Guided design preview" })).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});

for (const [name, action, endpoint] of [
  ["Review my architecture", "Run Foundry review", "review"],
  ["Deploy architecture to Azure", "Generate with Foundry agent", "deploy"],
] as const) {
  test(`${name}: Escape uses the existing request cancellation path`, async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`**/api/ai/${endpoint}`, async (route) => {
      await held;
      await route.fulfill({ status: 503, json: { error: "Late mocked failure must not reopen the dialog." } });
    });
    await studio(page);
    const { dialog, trigger } = await openByKeyboard(page, name);
    const requested = page.waitForRequest(`**/api/ai/${endpoint}`);
    await dialog.getByRole("button", { name: action, exact: true }).click();
    await requested;
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    release();
    await expect(page.getByText("Late mocked failure must not reopen the dialog.", { exact: true })).toHaveCount(0);
  });
}

test("AI committed graph saves cannot be cancelled by Escape, Clear, Close or Tab", async ({ page }) => {
  test.setTimeout(60_000);
  await page.route("**/api/ai/generate", (route) => route.fulfill({ json: proposal }));
  await studio(page);
  const { dialog, trigger } = await openByKeyboard(page, "AI Assist");
  await dialog.getByLabel("Describe what to build").fill("A mocked application");
  await dialog.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Guided design preview" })).toBeVisible();
  await holdNextSave(page);
  await dialog.getByRole("button", { name: "Apply generated design" }).click();
  for (const name of ["Close", "Clear AI session", "Cancel"]) {
    await expect(dialog.getByRole("button", { name, exact: true })).toBeDisabled();
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expectCycle(page, dialog);
  await expect(dialog.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
  await finishSave(page);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('.react-flow__node[data-id="proposal"]')).toBeVisible();
});

test("Whiteboard conversion traps focus, restores on cancellation and protects its committed save", async ({ page }) => {
  test.setTimeout(90_000);
  await page.route("**/api/ai/convert", (route) => route.fulfill({
    json: { payload: architecture, warnings: ["Mock conversion only."] },
  }));
  await page.goto("/diagrammatic?mode=whiteboard");
  const canvas = page.locator(".excalidraw");
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.locator("label").filter({ has: page.getByRole("radio", { name: "Rectangle", exact: true }) }).click();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Missing Whiteboard");
  await page.mouse.move(bounds.x + 220, bounds.y + 160);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 440, bounds.y + 300, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.press("Escape");
  const { dialog, trigger } = await openByKeyboard(page, "Convert Whiteboard to architecture");
  await expect(dialog.getByRole("button", { name: "Close conversion" })).toBeFocused();
  await expectCycle(page, dialog);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await dialog.getByRole("button", { name: "Analyze Whiteboard" }).click();
  await expect(dialog.getByRole("region", { name: "Conversion preview" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create architecture document" })).toBeDisabled();
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect(dialog).toBeInViewport({ ratio: 1 });
    for (const name of ["Cancel", "Analyze again", "Create architecture document"]) {
      await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }

  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await dialog.getByRole("checkbox", { name: /I reviewed this preview/ }).check();
  await holdNextSave(page);
  await dialog.getByRole("button", { name: "Create architecture document" }).click();
  await expect(dialog.getByRole("button", { name: "Close conversion" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expectCycle(page, dialog);
  await finishSave(page);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.react-flow__node[data-id="app"]')).toBeVisible();
});

test("shared hook releases a persistent drawer when it becomes an inline desktop panel", async ({ page }) => {
      const require = createRequire(join(process.cwd(), "package.json"));
      const readPackage = (name: string, file: string) =>
        readFileSync(join(dirname(require.resolve(`${name}/package.json`)), "cjs", file), "utf8");
      const modules = {
        react: readPackage("react", "react.development.js"),
        "react-dom": readPackage("react-dom", "react-dom.development.js"),
        "react-dom/client": readPackage("react-dom", "react-dom-client.development.js"),
        scheduler: readPackage("scheduler", "scheduler.development.js"),
        hook: ts.transpileModule(readFileSync(join(process.cwd(), "components", "diagrammatic", "shared", "useDialogFocus.ts"), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      };
      await page.route("https://dialog-focus.test/**", (route) => route.fulfill({
        contentType: "text/html", body: '<!doctype html><html><body><div id="root"></div></body></html>',
      }));
      await page.setViewportSize({ width: 1440, height: 844 });
      await page.goto("https://dialog-focus.test/");
      await page.addScriptTag({ content: `{
        const factories = {${Object.entries(modules).map(([name, source]) => `${JSON.stringify(name)}: function(module, exports, require, process) { ${source}\n }`).join(",")}};
        const cache = {};
        function require(name) {
          if (!cache[name]) {
            const module = { exports: {} };
            cache[name] = module;
            factories[name](module, module.exports, require, { env: { NODE_ENV: "development" } });
          }
          return cache[name].exports;
        }
        const React = require("react");
        const { useDialogFocus } = require("hook");
        function Panel() {
          const [compact, setCompact] = React.useState(false);
          const [open, setOpen] = React.useState(false);
          React.useEffect(() => {
            const query = matchMedia("(max-width: 1279px)");
            const update = () => setCompact(query.matches);
            update();
            query.addEventListener("change", update);
            return () => query.removeEventListener("change", update);
          }, []);
          const modal = compact && open;
          const ref = useDialogFocus({ open: modal, onClose: () => setOpen(false) });
          return React.createElement(React.Fragment, null,
            React.createElement("button", { id: "invoker", onClick: () => setOpen(true) }, "Open panel"),
            React.createElement("div", {
              id: "panel", ref, role: modal ? "dialog" : undefined,
              "aria-label": "Responsive panel", "aria-modal": modal ? true : undefined,
              tabIndex: modal ? -1 : undefined, style: { display: compact && !open ? "none" : "block" },
            }, React.createElement("input", { "aria-label": "Panel input" }),
              React.createElement("button", null, "Panel action")),
            React.createElement("button", null, "Outside action"));
        }
        require("react-dom/client").createRoot(document.getElementById("root"))
          .render(React.createElement(React.StrictMode, null, React.createElement(Panel)));
      }` });
      const panel = page.locator("#panel");
      const input = page.getByRole("textbox", { name: "Panel input" });
      const invoker = page.getByRole("button", { name: "Open panel" });
      await expect(input).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(panel).toBeHidden();
      await invoker.click();
      await expect(panel).toHaveAttribute("role", "dialog");
      await expect(input).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("button", { name: "Panel action" })).toBeFocused();
      await page.setViewportSize({ width: 1440, height: 844 });
      await expect(panel).not.toHaveAttribute("role");
      await expect(panel).not.toHaveAttribute("inert");
      await expect(panel).not.toHaveAttribute("aria-hidden", "true");
      await expect(panel).not.toHaveAttribute("aria-modal");
      await expect(page.getByRole("button", { name: "Panel action" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Outside action" })).toBeFocused();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(panel).toHaveAttribute("role", "dialog");
      await expect(input).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(page.getByRole("button", { name: "Outside action" })).toBeFocused();
      await page.setViewportSize({ width: 1440, height: 844 });
      await expect(input).toBeVisible();
      await expect(panel).not.toHaveAttribute("inert");
      await input.focus();
      await expect(input).toBeFocused();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`dialogs keep scrollable content and footer actions within ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    await studio(page);
    for (const [triggerName, dialogName] of [
      ["AI Assist", "AI Assist"],
      ["Review my architecture", "Review my architecture"],
      ["Deploy architecture to Azure", "Deploy architecture to Azure"],
      ["My diagrams", "Saved diagrams"],
    ]) {
      await page.setViewportSize({ width: 1280, height: 800 });
      const { dialog } = await openByKeyboard(page, triggerName, dialogName);
      await page.setViewportSize(viewport);
      await expect.poll(() => dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 &&
          element.scrollWidth <= element.clientWidth + 1;
      })).toBe(true);
      await expectCycle(page, dialog);
      if (dialogName === "AI Assist") {
        const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
        await expect(cancel).toBeInViewport();
        await expect(dialog.getByRole("button", { name: "Generate", exact: true })).toBeInViewport();
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "AI Assist", exact: true }).focus();
    await page.keyboard.press("Control+k");
    const commands = page.getByRole("dialog", { name: "Command palette" });
    await page.setViewportSize(viewport);
    await expect(commands).toBeInViewport({ ratio: 1 });
    await expectCycle(page, commands);
    await commands.getByRole("textbox", { name: "Search commands" }).fill("Keyboard shortcuts");
    await page.keyboard.press("Enter");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true });
    await expect(help).toBeInViewport({ ratio: 1 });
    await expectCycle(page, help);
    await page.keyboard.press("Escape");
  });
}
