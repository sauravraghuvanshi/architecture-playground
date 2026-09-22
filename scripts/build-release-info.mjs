import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseReleaseInfo } from "../lib/release-info.mjs";

export function buildReleaseInfo({ root = process.cwd(), expected = process.env.GITHUB_SHA } = {}) {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (expected && expected !== revision) throw new Error("Build checkout does not match the expected release revision.");
  const release = parseReleaseInfo({ schemaVersion: 1, revision, buildId: randomUUID(), builtAt: new Date().toISOString() });
  writeFileSync(join(root, "content", "release.json"), `${JSON.stringify(release)}\n`);
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Building release ${buildReleaseInfo().revision}.`);
}
