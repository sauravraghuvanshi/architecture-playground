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
