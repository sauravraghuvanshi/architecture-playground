/**
 * Headless smoke test for the Diagrammatic canvas.
 *
 *  1. Loads /diagrammatic
 *  2. Waits for the React Flow canvas to render
 *  3. Clicks the first palette icon
 *  4. Asserts that exactly one node appears with a visible label and an <img>
 *     pointing at the icon path. (This is the regression that the user
 *     reported: clicking a palette icon did nothing, and when nodes did
 *     appear the icon SVG inside them was missing.)
 *
 * Run with: `node scripts/smoke-canvas.mjs`
 * Requires the Next prod server on http://localhost:3030.
 */
import puppeteer from "puppeteer";

const URL = "http://localhost:3030/diagrammatic";

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

let exitCode = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      // ignore generic "Failed to load resource" — the response handler
      // already records the specific HTTP status with URL.
      if (/^Failed to load resource:/.test(t)) return;
      consoleErrors.push(t);
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));
  page.on("requestfailed", (req) =>
    consoleErrors.push(`REQFAIL ${req.failure()?.errorText} ${req.url()}`)
  );
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && !url.endsWith("/favicon.ico"))
      consoleErrors.push(`HTTP ${res.status()} ${url}`);
  });

  console.log("→ goto", URL);
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30_000 });

  // Wait for React Flow viewport.
  await page.waitForSelector(".react-flow__viewport", { timeout: 15_000 });
  console.log("✓ React Flow viewport mounted");

  // Wait for at least one palette icon button.
  await page.waitForSelector('aside button[draggable="true"]', { timeout: 10_000 });
  const paletteCount = await page.$$eval('aside button[draggable="true"]', (btns) => btns.length);
  console.log(`✓ Palette has ${paletteCount} icons`);
  if (paletteCount === 0) throw new Error("Palette empty");

  // Click first palette icon.
  await page.click('aside button[draggable="true"]:first-of-type');
  await new Promise((r) => setTimeout(r, 600));

  // Assert one node showed up.
  const nodes = await page.$$(".react-flow__node");
  console.log(`✓ Nodes after 1 click: ${nodes.length}`);
  if (nodes.length !== 1) throw new Error(`Expected 1 node, got ${nodes.length}`);

  // Click two more icons.
  const allBtns = await page.$$('aside button[draggable="true"]');
  await allBtns[1].click();
  await new Promise((r) => setTimeout(r, 200));
  await allBtns[2].click();
  await new Promise((r) => setTimeout(r, 600));

  const nodes3 = await page.$$(".react-flow__node");
  console.log(`✓ Nodes after 3 clicks: ${nodes3.length}`);
  if (nodes3.length !== 3) throw new Error(`Expected 3 nodes, got ${nodes3.length}`);

  // Inspect the first node — must contain an <img> with a non-empty src AND
  // a visible label.
  const nodeMeta = await page.evaluate(() => {
    const node = document.querySelector(".react-flow__node");
    if (!node) return { found: false };
    const img = node.querySelector("img");
    const text = node.textContent?.trim() ?? "";
    return {
      found: true,
      hasImg: !!img,
      imgSrc: img?.getAttribute("src") ?? null,
      imgVisibleSize: img ? { w: img.clientWidth, h: img.clientHeight } : null,
      label: text,
    };
  });
  console.log("✓ First node:", JSON.stringify(nodeMeta));
  if (!nodeMeta.hasImg) throw new Error("Node missing <img>");
  if (!nodeMeta.imgSrc?.startsWith("/cloud-icons/"))
    throw new Error(`Bad img src: ${nodeMeta.imgSrc}`);
  if ((nodeMeta.imgVisibleSize?.w ?? 0) < 10) throw new Error("Img has zero width");
  if (nodeMeta.label.length < 2) throw new Error(`Label too short: "${nodeMeta.label}"`);

  // Test prompt generation by visiting with ?prompt=.
  console.log("→ prompt-gen test");
  await page.goto(
    `${URL}?prompt=${encodeURIComponent("React frontend behind API Gateway calling AWS Lambda functions reading from DynamoDB and S3 with CloudWatch monitoring")}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    }
  );
  await page.waitForSelector(".react-flow__node", { timeout: 10_000 });
  await new Promise((r) => setTimeout(r, 800));
  const promptNodes = await page.$$(".react-flow__node");
  const promptEdges = await page.$$(".react-flow__edge");
  console.log(`✓ Prompt produced ${promptNodes.length} nodes, ${promptEdges.length} edges`);
  if (promptNodes.length < 3) throw new Error(`Prompt produced <3 nodes (got ${promptNodes.length})`);
  if (promptEdges.length < 2) throw new Error(`Prompt produced <2 edges (got ${promptEdges.length})`);

  // Phase-3: prompt should now produce at least one group/swimlane node.
  const groupNodes = await page.$$(".react-flow__node.react-flow__node-group");
  console.log(`✓ Group/swimlane nodes from prompt: ${groupNodes.length}`);
  if (groupNodes.length < 2)
    throw new Error(`Expected ≥2 group nodes from tiered prompt, got ${groupNodes.length}`);

  // Phase-3: addGroup via toolbar dropdown
  console.log("→ addGroup test");
  // Open the Tier dropdown.
  const tierBtn = await page.$$eval("button", (btns) => {
    const i = btns.findIndex((b) => /^Tier/.test(b.textContent ?? ""));
    return i;
  });
  if (tierBtn === -1) throw new Error("Tier dropdown button not found");
  const allBtnsAfter = await page.$$("button");
  await allBtnsAfter[tierBtn].click();
  await new Promise((r) => setTimeout(r, 250));
  const groupCountBefore = (await page.$$(".react-flow__node.react-flow__node-group")).length;
  // Click the "Compute" item in the menu.
  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("button"));
    const compute = items.find((b) => b.textContent?.trim() === "Compute");
    if (!compute) return false;
    compute.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    return true;
  });
  if (!clicked) throw new Error("Couldn't find Compute tier menu item");
  await new Promise((r) => setTimeout(r, 500));
  const groupCountAfter = (await page.$$(".react-flow__node.react-flow__node-group")).length;
  console.log(`✓ Groups before/after addGroup: ${groupCountBefore} → ${groupCountAfter}`);
  if (groupCountAfter !== groupCountBefore + 1)
    throw new Error(`addGroup didn't add a group node (before=${groupCountBefore}, after=${groupCountAfter})`);

  // Phase-3: sequence playback — clicking Play should add an active class
  // to at least one edge over time.
  console.log("→ sequence playback test");
  const playClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Play"
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!playClicked) throw new Error("Play button not found");
  // After 800ms one edge should have an active stroke style on its <path>.
  await new Promise((r) => setTimeout(r, 800));
  const animatedCount = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll(".react-flow__edge path.react-flow__edge-path"));
    return paths.filter((p) => {
      const s = p.style.animation;
      return s && s.includes("diagrammaticDash");
    }).length;
  });
  console.log(`✓ Edges with active animation during playback: ${animatedCount}`);
  if (animatedCount < 1) throw new Error("No edges show active sequence animation");
  // Stop playback.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Stop"
    );
    if (btn) btn.click();
  });

  // Phase-4: GroupNode header band must be visible (regression for the
  // user-reported "tier graphic looks bad — empty rectangle"). The new node
  // renders the tier label inside an opaque header band (≥ 20px tall).
  console.log("→ tier header visibility test");
  const tierHeaderOk = await page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll(".react-flow__node-group"));
    if (groups.length === 0) return { ok: false, reason: "no group nodes" };
    for (const g of groups) {
      const headerText = (g.textContent || "").trim();
      const rect = g.getBoundingClientRect();
      if (rect.height < 80 || rect.width < 80) continue;
      if (!headerText) continue;
      // Look for a child element that contains uppercase tier text (EDGE,
      // FRONTEND, COMPUTE, …). Our header band uses `tracking-[0.14em]`.
      const tierBands = Array.from(g.querySelectorAll("span")).filter((s) => {
        const t = (s.textContent || "").trim();
        return /^(edge|frontend|gateway|compute|messaging|data|ops|custom|group)$/i.test(t);
      });
      if (tierBands.length > 0) {
        const tb = tierBands[0];
        const tbRect = tb.getBoundingClientRect();
        if (tbRect.width >= 20 && tbRect.height >= 8)
          return { ok: true, label: tb.textContent };
      }
    }
    return { ok: false, reason: "no visible tier header band" };
  });
  console.log(`✓ Tier header: ${JSON.stringify(tierHeaderOk)}`);
  if (!tierHeaderOk.ok) throw new Error("Tier header band not visible");

  // Phase-4: Export button exists and JSON export triggers a download blob.
  console.log("→ export button test");
  const exportPresent = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).some(
      (b) => b.textContent?.trim().startsWith("Export")
    );
  });
  if (!exportPresent) throw new Error("Export button not present in toolbar");
  console.log("✓ Export button present");

  // Phase-4: Visiting `?prompt=…` (used by hub TemplateBrowser cards) seeds
  // the canvas with a non-empty graph.
  console.log("→ template→prompt deeplink test");
  await page.goto(
    `${URL}?prompt=${encodeURIComponent("Three tier web app on Azure with App Service and Azure SQL")}`,
    { waitUntil: "networkidle2", timeout: 30_000 }
  );
  await page.waitForSelector(".react-flow__viewport", { timeout: 15_000 });
  await new Promise((r) => setTimeout(r, 1200));
  const tplNodeCount = (await page.$$(".react-flow__node")).length;
  console.log(`✓ Template-deeplink produced ${tplNodeCount} nodes`);
  if (tplNodeCount < 3)
    throw new Error(`Template deeplink underseeded the canvas (got ${tplNodeCount}, expected ≥3)`);

  // Hard-fail on any console errors.
  if (consoleErrors.length) {
    console.error("✗ Console errors during run:");
    for (const e of consoleErrors) console.error("   ", e);
    throw new Error(`${consoleErrors.length} console error(s)`);
  }

  console.log("\n✅ ALL CHECKS PASSED");
} catch (err) {
  console.error("\n❌ FAILED:", err.message);
  exitCode = 1;
} finally {
  await browser.close();
}

process.exit(exitCode);
