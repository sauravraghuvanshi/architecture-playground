import puppeteer from "puppeteer";
import fs from "node:fs";

const PAGES = ["/", "/diagrammatic", "/about", "/templates"];
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

let exit = 0;
const errs = [];
page.on("response", (r) => {
  const u = r.url();
  if (r.status() >= 400 && !u.endsWith("/favicon.ico"))
    errs.push(`HTTP ${r.status()} ${u}`);
});
page.on("pageerror", (e) => errs.push(`PAGEERR ${e.message}`));

fs.mkdirSync("scripts/.screenshots", { recursive: true });

for (const p of PAGES) {
  errs.length = 0;
  console.log(`→ ${p}`);
  await page.goto(`http://localhost:3030${p}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  const fname = `scripts/.screenshots/page_${p.replace(/[/[\]]/g, "_") || "_root"}.png`;
  await page.screenshot({ path: fname, fullPage: false });
  console.log(`  ✓ shot ${fname}`);
  if (errs.length) {
    console.error(`  ✗ ${p}: ${errs.length} errors`);
    for (const e of errs) console.error("    ", e);
    exit = 1;
  } else {
    console.log(`  ✓ no errors`);
  }
}
await browser.close();
process.exit(exit);
