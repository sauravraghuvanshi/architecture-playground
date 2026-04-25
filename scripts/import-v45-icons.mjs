/**
 * import-v45-icons.mjs — Import Microsoft Azure Architecture Icons V4.5
 * into the public/cloud-icons/azure/ directory.
 *
 * Reads from: Sample-Architecture/V-4.5/V-4.5/SVG_Azure_Grouped/<Category>/*.svg
 * Writes to:  public/cloud-icons/azure/<category-slug>/<icon-slug>.svg
 *
 * Preserves existing hand-picked icons and adds the V-4.5 set alongside them.
 * Deduplicates by slug — if a slug already exists, the existing file wins.
 */
import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT = path.join(
  process.cwd(),
  "Sample-Architecture",
  "V-4.5",
  "V-4.5",
  "SVG_Azure_Grouped"
);
const DEST_ROOT = path.join(process.cwd(), "public", "cloud-icons", "azure");

/** Map V-4.5 folder names to our kebab-case category slugs. */
const CATEGORY_MAP = {
  AI: "ai",
  Application: "application",
  Compute: "compute",
  Data: "data",
  Deployment: "deployment",
  "Dynamics 365": "dynamics-365",
  Endpoint: "endpoint",
  Generic: "general",
  Identity: "identity",
  IoT: "iot",
  Management: "management",
  Networking: "networking",
  Office365: "office-365",
  Security: "security",
  Storage: "storage",
  Workload: "workload",
};

/** Convert "AKS Cluster Configuration.svg" → "aks-cluster-configuration" */
function toSlug(filename) {
  return filename
    .replace(/\.svg$/i, "")
    .replace(/[()]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

let imported = 0;
let skipped = 0;
let categories = 0;

const sourceDirs = fs.readdirSync(SOURCE_ROOT);

for (const dir of sourceDirs) {
  const srcCatPath = path.join(SOURCE_ROOT, dir);
  if (!fs.statSync(srcCatPath).isDirectory()) continue;

  const catSlug = CATEGORY_MAP[dir];
  if (!catSlug) {
    console.warn(`⚠  Unmapped category: "${dir}" — skipping`);
    continue;
  }

  const destCatPath = path.join(DEST_ROOT, catSlug);
  fs.mkdirSync(destCatPath, { recursive: true });
  categories++;

  const svgs = fs.readdirSync(srcCatPath).filter((f) => f.endsWith(".svg"));

  for (const svg of svgs) {
    const slug = toSlug(svg);
    const destFile = path.join(destCatPath, `${slug}.svg`);

    if (fs.existsSync(destFile)) {
      skipped++;
      continue;
    }

    fs.copyFileSync(path.join(srcCatPath, svg), destFile);
    imported++;
  }
}

console.log(`\n✅ Import complete`);
console.log(`   Categories: ${categories}`);
console.log(`   Imported:   ${imported}`);
console.log(`   Skipped:    ${skipped} (already existed)`);
console.log(`   Total Azure icons: ${imported + skipped + fs.readdirSync(DEST_ROOT).reduce((sum, d) => {
  const p = path.join(DEST_ROOT, d);
  return sum + (fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(f => f.endsWith(".svg")).length : 0);
}, 0) - imported - skipped}`);
