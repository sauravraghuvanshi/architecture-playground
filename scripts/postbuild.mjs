// scripts/postbuild.mjs
// Copies public/ and .next/static/ into .next/standalone/ after next build.
// Required so the standalone server can serve static assets.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parserSourceHash } from "./artifact-parser-build-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const standaloneDir = path.join(root, ".next", "standalone");
if (!fs.existsSync(standaloneDir)) {
  console.log("[postbuild] No standalone dir found — skipping.");
  process.exit(0);
}

console.log("[postbuild] Copying public/ → .next/standalone/public/");
copyDir(path.join(root, "public"), path.join(standaloneDir, "public"));

console.log("[postbuild] Copying .next/static/ → .next/standalone/.next/static/");
copyDir(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));

// Explicitly copy content/ → standalone so lazy field-merge and other runtime
// reads always have the latest bundled JSON/MDX, independent of Next.js tracing.
console.log("[postbuild] Copying content/ → .next/standalone/content/");
copyDir(path.join(root, "content"), path.join(standaloneDir, "content"));

const parserDirectory = path.join(root, "node_modules", ".cache", "artifact-validation");
const parserManifest = path.join(parserDirectory, "manifest.json");
if (!fs.existsSync(parserManifest)) throw new Error("Trusted parser helpers are missing. Run npm run build:validators before the application build.");
const manifest = JSON.parse(fs.readFileSync(parserManifest, "utf8"));
const expectedTarget = process.platform === "win32" ? "win-x64" : "linux-x64";
if (manifest.version !== 1 || manifest.target !== expectedTarget || parserSourceHash(root) !== manifest.sourceHash) {
  throw new Error("Parser helpers are stale or target the wrong platform. Run npm run build:validators.");
}
console.log("[postbuild] Copying trusted parser helpers into standalone/");
copyDir(parserDirectory, path.join(standaloneDir, "artifact-validation"));
if (process.platform !== "win32") {
  fs.chmodSync(path.join(standaloneDir, "artifact-validation", "hcl-parser"), 0o755);
  fs.chmodSync(path.join(standaloneDir, "artifact-validation", "dotnet", "Diagrammatic.ArtifactParser"), 0o755);
}

console.log("[postbuild] Done.");
