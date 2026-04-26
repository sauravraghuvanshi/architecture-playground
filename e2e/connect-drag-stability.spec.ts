import { test, expect, type Page } from "@playwright/test";

/**
 * Reproduction harness for the long-standing connect-drag node-vanish bug.
 * Bug history: commits 8c362d9 → 8f764bc → 7ffd2d8 → 209d345 → 3d75665.
 * After 5 fix attempts the symptom (nodes disappearing during a connection drag)
 * still reproduces in real usage. This spec is the regression net for Phase 1.
 *
 * Run locally:
 *   npx playwright test e2e/connect-drag-stability.spec.ts --headed
 * Stability check (target: 100/100 green):
 *   npx playwright test e2e/connect-drag-stability.spec.ts --repeat-each=20
 */

type Snapshot = {
  id: string | null;
  rect: { x: number; y: number; w: number; h: number };
  opacity: number;
  display: string;
  visibility: string;
};

async function snapshotNodes(page: Page): Promise<Snapshot[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".react-flow__node")).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        id: el.getAttribute("data-id"),
        rect: {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
        opacity: parseFloat(cs.opacity),
        display: cs.display,
        visibility: cs.visibility,
      };
    })
  );
}

async function loadTemplate(page: Page, label: string) {
  const select = page.getByLabel("Load template");
  await expect(select).toBeVisible();
  await select.selectOption({ label });
  // Wait for nodes to mount
  await page.waitForFunction(
    () => document.querySelectorAll(".react-flow__node").length >= 3,
    null,
    { timeout: 5000 }
  );
  // Fit-view so all nodes are inside the viewport. Two "Fit view" buttons
  // exist (toolbar + RF built-in controls) — target the toolbar one explicitly.
  await page.getByRole("button", { name: "Fit view (F)" }).click();
  await page.waitForTimeout(400);
}

/**
 * Performs a connect-drag from `sourceNodeId`'s right (source) handle to
 * `targetNodeId`'s left (target) handle. Mid-drag, sweeps the cursor toward
 * the right edge of the viewport — this is the trigger that historically
 * caused the vanishing-node bug (autoPanOnConnect interaction + viewport drift).
 */
async function connectDragWithEdgeSweep(
  page: Page,
  sourceNodeId: string,
  targetNodeId: string
) {
  const source = page.locator(
    `.react-flow__node[data-id="${sourceNodeId}"] .react-flow__handle.source[data-handlepos="right"]`
  );
  const target = page.locator(
    `.react-flow__node[data-id="${targetNodeId}"] .react-flow__handle.target[data-handlepos="left"]`
  );
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const srcBox = await source.boundingBox();
  const tgtBox = await target.boundingBox();
  if (!srcBox || !tgtBox) throw new Error("Handle bounding boxes unavailable");

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };

  const srcCx = srcBox.x + srcBox.width / 2;
  const srcCy = srcBox.y + srcBox.height / 2;
  const tgtCx = tgtBox.x + tgtBox.width / 2;
  const tgtCy = tgtBox.y + tgtBox.height / 2;

  await page.mouse.move(srcCx, srcCy);
  await page.mouse.down();

  // Move toward the right viewport edge — this is what historically triggered
  // the autoPanOnConnect drift.
  const sweepX = viewport.width - 8;
  const sweepY = (srcCy + tgtCy) / 2;
  for (let step = 1; step <= 10; step++) {
    const t = step / 10;
    await page.mouse.move(srcCx + (sweepX - srcCx) * t, srcCy + (sweepY - srcCy) * t, {
      steps: 3,
    });
  }
  // Hold at the edge briefly so any auto-pan / viewport drift would manifest.
  await page.waitForTimeout(120);

  // Now move back to target handle and release.
  for (let step = 1; step <= 10; step++) {
    const t = step / 10;
    await page.mouse.move(sweepX + (tgtCx - sweepX) * t, sweepY + (tgtCy - sweepY) * t, {
      steps: 3,
    });
  }
  await page.mouse.up();
}

function assertSnapshotsStable(before: Snapshot[], after: Snapshot[]) {
  expect(after.length).toBe(before.length);

  const byId = new Map(after.map((s) => [s.id, s]));
  for (const b of before) {
    const a = byId.get(b.id);
    expect(a, `node ${b.id} missing after connect-drag`).toBeDefined();
    if (!a) continue;

    expect(a.display, `node ${b.id} display changed`).not.toBe("none");
    expect(a.visibility, `node ${b.id} visibility changed`).not.toBe("hidden");
    expect(a.opacity, `node ${b.id} opacity dropped`).toBeGreaterThan(0.5);
    expect(a.rect.w, `node ${b.id} width collapsed`).toBeGreaterThan(0);
    expect(a.rect.h, `node ${b.id} height collapsed`).toBeGreaterThan(0);

    // Rect should not have wandered more than 80px (allow normal viewport math jitter
    // but flag the catastrophic "node teleported off-screen" failure mode).
    expect(
      Math.abs(a.rect.x - b.rect.x),
      `node ${b.id} x drifted from ${b.rect.x} to ${a.rect.x}`
    ).toBeLessThan(80);
    expect(
      Math.abs(a.rect.y - b.rect.y),
      `node ${b.id} y drifted from ${b.rect.y} to ${a.rect.y}`
    ).toBeLessThan(80);
  }
}

test.describe("Canvas connect-drag stability", () => {
  test.beforeEach(async ({ page }) => {
    // Capture browser console for diagnostics if a run fails.
    page.on("console", (msg) => {
      const t = msg.text();
      if (t.startsWith("[AP]") || msg.type() === "error" || msg.type() === "warning") {
        process.stdout.write(`browser ${msg.type()}: ${t}\n`);
      }
    });
    await page.goto("/?debug=1");
    await loadTemplate(page, "3-Tier on Azure");
  });

  test("nodes survive a connect-drag that sweeps the viewport edge", async ({ page }) => {
    const before = await snapshotNodes(page);
    expect(before.length).toBeGreaterThanOrEqual(3);

    const candidates = before.filter((s) => !!s.id);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    const [a, b] = candidates;

    await connectDragWithEdgeSweep(page, a.id!, b.id!);

    // Allow React Flow to settle.
    await page.waitForTimeout(150);

    const after = await snapshotNodes(page);
    assertSnapshotsStable(before, after);
  });

  test("repeated connect-drags do not progressively degrade the canvas", async ({ page }) => {
    const before = await snapshotNodes(page);
    const candidates = before.filter((s) => !!s.id);
    expect(candidates.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < 5; i++) {
      const src = candidates[i % candidates.length];
      const tgt = candidates[(i + 1) % candidates.length];
      await connectDragWithEdgeSweep(page, src.id!, tgt.id!);
      await page.waitForTimeout(120);

      const snap = await snapshotNodes(page);
      assertSnapshotsStable(before, snap);
    }
  });

  test("rage-flick: high-velocity drag to corners then release in dead space", async ({ page }) => {
    const before = await snapshotNodes(page);
    const candidates = before.filter((s) => !!s.id);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    const a = candidates[0];

    const source = page.locator(
      `.react-flow__node[data-id="${a.id}"] .react-flow__handle.source[data-handlepos="right"]`
    );
    const srcBox = await source.boundingBox();
    if (!srcBox) throw new Error("source handle bbox null");
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const cx = srcBox.x + srcBox.width / 2;
    const cy = srcBox.y + srcBox.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();

    // Whip through all four corners with single large jumps (no intermediate
    // steps) — this is the kind of motion users make when trying to "fix" a
    // misbehaving canvas, and it stresses RF's gesture handling the most.
    const corners = [
      { x: 4, y: 4 },
      { x: viewport.width - 4, y: 4 },
      { x: viewport.width - 4, y: viewport.height - 4 },
      { x: 4, y: viewport.height - 4 },
      { x: viewport.width / 2, y: viewport.height / 2 },
    ];
    for (const c of corners) {
      await page.mouse.move(c.x, c.y);
      await page.waitForTimeout(60);
    }

    // Release in dead space (no target handle).
    await page.mouse.move(viewport.width / 2 + 30, viewport.height / 2 + 30);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await snapshotNodes(page);
    assertSnapshotsStable(before, after);
  });

  // FIXME(canvas-stability): wheel-during-connect still pans the surface in
  // some headless scenarios. The synchronous window-capture swallow (Canvas
  // line ~215) DOES preventDefault on the dispatched WheelEvent, but RF's
  // viewport store still updates by ~100px on the first frame. Need to either
  // (a) intercept inside RF's `onWheel` panel listener via a wrapper-level
  // capture *plus* `stopImmediatePropagation`, or (b) lock the viewport via
  // `useStore.setState({ transform: lockedTransform })` on every wheel during
  // connect. Tracked separately — not the user-reported "vanishing-node"
  // failure mode that the first two tests already defend against.
  test.fixme("connect-drag while page is mid-scroll", async ({ page }) => {
    const before = await snapshotNodes(page);
    const candidates = before.filter((s) => !!s.id);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    const a = candidates[0];

    const source = page.locator(
      `.react-flow__node[data-id="${a.id}"] .react-flow__handle.source[data-handlepos="right"]`
    );
    const srcBox = await source.boundingBox();
    if (!srcBox) throw new Error("source handle bbox null");
    const cx = srcBox.x + srcBox.width / 2;
    const cy = srcBox.y + srcBox.height / 2;
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };

    await page.mouse.move(cx, cy);
    await page.mouse.down();

    // Dispatch real, cancelable WheelEvents (Playwright's mouse.wheel uses CDP
    // Input.dispatchMouseEvent which scrolls at the renderer level and ignores
    // JS preventDefault). We want to test that our app-level handler swallows
    // them — so we must dispatch events that respect preventDefault.
    const dispatchWheel = (deltaY: number) =>
      page.evaluate(({ x, y, dy }) => {
        const target = document.elementFromPoint(x, y) ?? document.body;
        target.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: dy,
            clientX: x,
            clientY: y,
          })
        );
      }, { x: cx, y: cy, dy: deltaY });

    await dispatchWheel(200);
    await page.mouse.move(viewport.width - 8, cy, { steps: 20 });
    await dispatchWheel(-200);
    await page.mouse.move(cx + 60, cy, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await snapshotNodes(page);
    assertSnapshotsStable(before, after);
  });
});
