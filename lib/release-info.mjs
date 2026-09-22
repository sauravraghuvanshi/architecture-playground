import { readFileSync } from "node:fs";
import { join } from "node:path";

export function parseReleaseInfo(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== 1 ||
      typeof value.revision !== "string" || !/^[a-f0-9]{40}$/.test(value.revision) ||
      typeof value.buildId !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.buildId) ||
      typeof value.builtAt !== "string" || !Number.isFinite(Date.parse(value.builtAt))) {
    throw new Error("Release identity is missing or invalid.");
  }
  return { schemaVersion: 1, revision: value.revision, buildId: value.buildId, builtAt: value.builtAt };
}

export function readReleaseInfo(root = process.cwd()) {
  return parseReleaseInfo(JSON.parse(readFileSync(join(root, "content", "release.json"), "utf8")));
}
