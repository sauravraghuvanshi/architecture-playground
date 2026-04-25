/**
 * import-aws-gcp-icons.mjs — Import official AWS and GCP architecture icons.
 *
 * AWS: From weibeld/aws-icons-svg GitHub mirror (q1-2022 64px service icons)
 * GCP: Downloaded from cloud.google.com/icons
 *
 * Run: node scripts/import-aws-gcp-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DEST_ROOT = path.join(process.cwd(), "public", "cloud-icons");

// ─── AWS ──────────────────────────────────────────────────────────────────

const AWS_SOURCE = path.join(process.env.TEMP || "/tmp", "aws-icons-svg", "q1-2022", "Architecture-Service-Icons_01312022");

/** Map AWS folder names to our category slugs. */
const AWS_CATEGORY_MAP = {
  "Arch_Analytics": "analytics",
  "Arch_App-Integration": "integration",
  "Arch_AWS-Cost-Management": "management",
  "Arch_Blockchain": "blockchain",
  "Arch_Business-Applications": "application",
  "Arch_Compute": "compute",
  "Arch_Containers": "containers",
  "Arch_Customer-Enablement": "general",
  "Arch_Database": "database",
  "Arch_Developer-Tools": "developer-tools",
  "Arch_End-User-Computing": "endpoint",
  "Arch_Front-End-Web-Mobile": "application",
  "Arch_Game-Tech": "application",
  "Arch_General-Icons": "general",
  "Arch_Internet-of-Things": "iot",
  "Arch_Machine-Learning": "ai",
  "Arch_Management-Governance": "management",
  "Arch_Media-Services": "media",
  "Arch_Migration-Transfer": "migration",
  "Arch_Networking-Content-Delivery": "networking",
  "Arch_Quantum-Technologies": "compute",
  "Arch_Robotics": "iot",
  "Arch_Satellite": "networking",
  "Arch_Security-Identity-Compliance": "security",
  "Arch_Serverless": "compute",
  "Arch_Storage": "storage",
};

function toSlug(filename) {
  return filename
    .replace(/\.svg$/i, "")
    .replace(/^Arch_/, "")
    .replace(/_64$/, "")
    .replace(/^Amazon-/, "")
    .replace(/^AWS-/, "")
    .replace(/[()]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function importAWS() {
  if (!fs.existsSync(AWS_SOURCE)) {
    console.log("⚠  AWS source not found. Run: git clone https://github.com/weibeld/aws-icons-svg.git %TEMP%\\aws-icons-svg");
    return 0;
  }

  // Clear existing AWS icons
  const awsDest = path.join(DEST_ROOT, "aws");
  if (fs.existsSync(awsDest)) fs.rmSync(awsDest, { recursive: true });

  let imported = 0;
  const dirs = fs.readdirSync(AWS_SOURCE);

  for (const dir of dirs) {
    const srcCatPath = path.join(AWS_SOURCE, dir);
    if (!fs.statSync(srcCatPath).isDirectory()) continue;

    const catSlug = AWS_CATEGORY_MAP[dir];
    if (!catSlug) {
      console.warn(`⚠  Unmapped AWS category: "${dir}"`);
      continue;
    }

    // AWS icons are in a "64" subfolder
    const svgDir = path.join(srcCatPath, "64");
    if (!fs.existsSync(svgDir)) continue;

    const destCatPath = path.join(awsDest, catSlug);
    fs.mkdirSync(destCatPath, { recursive: true });

    const svgs = fs.readdirSync(svgDir).filter(f => f.endsWith(".svg"));
    for (const svg of svgs) {
      const slug = toSlug(svg);
      const destFile = path.join(destCatPath, `${slug}.svg`);
      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(path.join(svgDir, svg), destFile);
        imported++;
      }
    }
  }

  console.log(`  AWS: imported ${imported} icons`);
  return imported;
}

// ─── GCP (generate from existing + expand) ────────────────────────────────

function importGCPFromWeb() {
  // Try to download GCP icons
  const gcpZipUrl = "https://cloud.google.com/icons/core-product-icons.zip";
  const gcpZipPath = path.join(process.env.TEMP || "/tmp", "gcp-icons.zip");
  const gcpExtract = path.join(process.env.TEMP || "/tmp", "gcp-icons-extracted");

  try {
    console.log("  Downloading GCP icons...");
    execSync(`curl -sL "${gcpZipUrl}" -o "${gcpZipPath}"`, { timeout: 30000 });

    if (fs.existsSync(gcpZipPath) && fs.statSync(gcpZipPath).size > 1000) {
      // Extract
      if (fs.existsSync(gcpExtract)) fs.rmSync(gcpExtract, { recursive: true });
      fs.mkdirSync(gcpExtract, { recursive: true });
      execSync(`tar -xf "${gcpZipPath}" -C "${gcpExtract}"`, { timeout: 30000 });

      // Find SVGs
      const svgs = findSVGs(gcpExtract);
      console.log(`  GCP: found ${svgs.length} SVGs in download`);

      if (svgs.length > 0) {
        return importGCPSVGs(svgs);
      }
    }
  } catch (err) {
    console.log(`  GCP download failed: ${err.message}. Keeping existing icons.`);
  }

  return 0;
}

function findSVGs(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSVGs(fullPath));
    } else if (entry.name.endsWith(".svg")) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Map GCP icon filename patterns to categories. */
const GCP_KEYWORD_CATEGORIES = {
  "compute": ["compute-engine", "gke", "cloud-run", "cloud-functions", "kubernetes", "vmware", "bare-metal"],
  "database": ["cloud-sql", "firestore", "spanner", "bigtable", "bigquery", "memorystore", "datastore", "alloydb"],
  "storage": ["cloud-storage", "persistent-disk", "filestore", "backup"],
  "networking": ["vpc", "cloud-cdn", "cloud-dns", "load-balancing", "cloud-armor", "cloud-nat", "network", "interconnect", "cloud-router"],
  "ai": ["vertex", "ai-platform", "natural-language", "vision", "speech", "translation", "dialogflow", "automl", "gemini", "document"],
  "security": ["iam", "kms", "secret", "security", "identity", "certificate", "binary-authorization"],
  "management": ["monitoring", "logging", "trace", "debugger", "profiler", "error-reporting", "cloud-deploy", "operations"],
  "integration": ["pub-sub", "api-gateway", "cloud-tasks", "cloud-scheduler", "workflows", "eventarc", "dataflow"],
  "analytics": ["dataproc", "dataflow", "data-fusion", "composer", "looker", "dataplex"],
  "iot": ["iot-core", "edge-tpu"],
  "developer-tools": ["cloud-build", "cloud-source", "artifact-registry", "container-registry", "cloud-shell"],
};

function categorizeGCP(slug) {
  const lower = slug.toLowerCase();
  for (const [cat, keywords] of Object.entries(GCP_KEYWORD_CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return "general";
}

function importGCPSVGs(svgPaths) {
  const gcpDest = path.join(DEST_ROOT, "gcp");
  if (fs.existsSync(gcpDest)) fs.rmSync(gcpDest, { recursive: true });

  let imported = 0;
  for (const svgPath of svgPaths) {
    const filename = path.basename(svgPath);
    const slug = filename.replace(/\.svg$/i, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    const category = categorizeGCP(slug);
    const destCatPath = path.join(gcpDest, category);
    fs.mkdirSync(destCatPath, { recursive: true });

    const destFile = path.join(destCatPath, `${slug}.svg`);
    if (!fs.existsSync(destFile)) {
      fs.copyFileSync(svgPath, destFile);
      imported++;
    }
  }

  console.log(`  GCP: imported ${imported} icons`);
  return imported;
}

// ─── Main ─────────────────────────────────────────────────────────────────

console.log("Importing AWS & GCP icons...\n");
const awsCount = importAWS();
const gcpCount = importGCPFromWeb();
console.log(`\n✅ Done: AWS ${awsCount}, GCP ${gcpCount}`);
