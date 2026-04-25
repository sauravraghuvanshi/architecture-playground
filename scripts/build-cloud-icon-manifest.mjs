#!/usr/bin/env node
/**
 * Walks `public/cloud-icons/<cloud>/<category>/*.svg` and writes
 * `content/cloud-icons.json` — the manifest the playground reads at build time.
 *
 * Manifest entry:
 *   { id: "azure/compute/app-service", cloud: "azure", category: "compute",
 *     slug: "app-service", label: "App Service", path: "/cloud-icons/azure/compute/app-service.svg" }
 *
 * Run: node scripts/build-cloud-icon-manifest.mjs
 * (Also runs as part of `prebuild`.)
 */
import { readdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_DIR = join(ROOT, "public", "cloud-icons");
const OUT_FILE = join(ROOT, "content", "cloud-icons.json");

const CLOUDS = ["azure", "aws", "gcp"];
const CLOUD_LABELS = { azure: "Azure", aws: "AWS", gcp: "Google Cloud" };

const CATEGORY_LABELS = {
  ai: "AI & Machine Learning",
  application: "Application",
  compute: "Compute",
  data: "Data",
  database: "Database",
  deployment: "Deployment",
  "dynamics-365": "Dynamics 365",
  endpoint: "Endpoint",
  general: "General",
  identity: "Identity & Security",
  integration: "Integration & Messaging",
  iot: "IoT",
  management: "Management & Governance",
  monitor: "Monitoring & Observability",
  networking: "Networking",
  "office-365": "Office 365",
  security: "Security",
  storage: "Storage",
  workload: "Workload",
  other: "Other",
};

function slugToLabel(slug) {
  return slug
    .split("-")
    .map((part) => {
      if (/^[a-z]{2,4}$/.test(part) && part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

async function safeReaddir(p) {
  try {
    return await readdir(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function build() {
  const icons = [];
  for (const cloud of CLOUDS) {
    const cloudDir = join(ICONS_DIR, cloud);
    const categories = await safeReaddir(cloudDir);
    for (const cat of categories) {
      if (!cat.isDirectory()) continue;
      const category = cat.name;
      const catDir = join(cloudDir, category);
      const files = await safeReaddir(catDir);
      for (const f of files) {
        if (!f.isFile() || !f.name.endsWith(".svg")) continue;
        const slug = f.name.replace(/\.svg$/i, "");
        icons.push({
          id: `${cloud}/${category}/${slug}`,
          cloud,
          cloudLabel: CLOUD_LABELS[cloud],
          category,
          categoryLabel: CATEGORY_LABELS[category] || slugToLabel(category),
          slug,
          label: slugToLabel(slug),
          path: `/cloud-icons/${cloud}/${category}/${f.name}`,
        });
      }
    }
  }

  icons.sort((a, b) =>
    a.cloud.localeCompare(b.cloud) ||
    a.category.localeCompare(b.category) ||
    a.label.localeCompare(b.label)
  );

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: icons.length,
    icons,
  };

  await writeFile(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ Wrote ${icons.length} icons → content/cloud-icons.json`);
  const byCloud = icons.reduce((acc, i) => {
    acc[i.cloud] = (acc[i.cloud] || 0) + 1;
    return acc;
  }, {});
  for (const [c, n] of Object.entries(byCloud)) console.log(`  ${c}: ${n}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
