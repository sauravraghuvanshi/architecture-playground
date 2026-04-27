import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errs = [];
page.on("pageerror", (e) => errs.push(`PAGEERROR: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(`CONSOLE: ${m.text()}`);
});

await page.goto("http://localhost:3030/diagrammatic", { waitUntil: "networkidle2" });
await page.waitForSelector(".react-flow__viewport", { timeout: 15_000 });
await new Promise((r) => setTimeout(r, 800));

// Add 2 icons via the palette
async function clickPalette() {
  return page.evaluate(() => {
    const btn = document.querySelector(".overflow-y-auto button[draggable]");
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  });
}
await clickPalette();
await new Promise((r) => setTimeout(r, 300));
await clickPalette();
await new Promise((r) => setTimeout(r, 600));

const before = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll(".react-flow__node-icon"));
  return nodes.map((n) => ({
    visible: n.getBoundingClientRect().width > 0,
    hasImg: !!n.querySelector("img"),
    imgVisible: (() => {
      const img = n.querySelector("img");
      if (!img) return false;
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })(),
  }));
});
console.log("BEFORE connect:", JSON.stringify(before, null, 2));

// Get handle positions and simulate a connect drag.
const handleInfo = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll(".react-flow__node-icon"));
  if (nodes.length < 2) return null;
  // Source handle on first node (right/bottom), target handle on second (left/top).
  const srcHandle = nodes[0].querySelector(".react-flow__handle.source") || nodes[0].querySelector(".react-flow__handle");
  const tgtHandle = nodes[1].querySelector(".react-flow__handle.target") || nodes[1].querySelector(".react-flow__handle");
  if (!srcHandle || !tgtHandle) return null;
  const a = srcHandle.getBoundingClientRect();
  const b = tgtHandle.getBoundingClientRect();
  return {
    src: { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    tgt: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  };
});
console.log("Handles:", JSON.stringify(handleInfo));

if (handleInfo) {
  // React Flow uses pointer events. Use CDP to dispatch them properly.
  const client = await page.target().createCDPSession();
  async function pointer(type, x, y, button = "left") {
    await client.send("Input.dispatchMouseEvent", {
      type,
      x, y,
      button,
      buttons: type === "mouseReleased" ? 0 : 1,
      clickCount: type === "mousePressed" ? 1 : 0,
      pointerType: "mouse",
    });
  }
  await pointer("mouseMoved", handleInfo.src.x, handleInfo.src.y);
  await pointer("mousePressed", handleInfo.src.x, handleInfo.src.y);
  await new Promise((r) => setTimeout(r, 100));
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await pointer(
      "mouseMoved",
      handleInfo.src.x + (handleInfo.tgt.x - handleInfo.src.x) * t,
      handleInfo.src.y + (handleInfo.tgt.y - handleInfo.src.y) * t
    );
    await new Promise((r) => setTimeout(r, 40));
  }
  // Slight overshoot then back to land squarely on the target handle
  await pointer("mouseMoved", handleInfo.tgt.x, handleInfo.tgt.y);
  await new Promise((r) => setTimeout(r, 100));
  await pointer("mouseReleased", handleInfo.tgt.x, handleInfo.tgt.y);
  await new Promise((r) => setTimeout(r, 1200));
}

const after = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll(".react-flow__node-icon"));
  const edges = Array.from(document.querySelectorAll(".react-flow__edge"));
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.map((n) => {
      const img = n.querySelector("img");
      const imgRect = img?.getBoundingClientRect();
      const label = n.querySelector("div.line-clamp-2")?.textContent;
      return {
        visible: n.getBoundingClientRect().width > 0,
        hasImg: !!img,
        imgVisible: !!imgRect && imgRect.width > 0 && imgRect.height > 0,
        imgSrc: img?.getAttribute("src") || null,
        label,
        opacity: window.getComputedStyle(n).opacity,
        display: window.getComputedStyle(n).display,
      };
    }),
  };
});
console.log("AFTER connect:", JSON.stringify(after, null, 2));

if (errs.length) {
  console.log("\nErrors:", errs);
}

await browser.close();
