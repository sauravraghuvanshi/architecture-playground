import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";
import { parseReleaseInfo, readReleaseInfo } from "../lib/release-info.mjs";
import { buildReleaseInfo } from "./build-release-info.mjs";
import { verifyRelease } from "./verify-release.mjs";
import { releaseBrowserSuites } from "./release-browser-suites.mjs";

const expected = { schemaVersion: 1, revision: "a".repeat(40), buildId: "00000000-0000-4000-8000-000000000001", builtAt: "2026-09-22T00:00:00.000Z" };
function harness(releases, options = {}) {
  let probes = 0;
  let logouts = 0;
  const calls = [];
  return {
    get probes() { return probes; },
    get logouts() { return logouts; },
    calls,
    run: () => verifyRelease({
      baseUrl: "https://release.example", expected, username: "synthetic", password: "test-only",
      attempts: 6, wait: async () => {},
      fetchImpl: async (url, init) => {
        calls.push({ url, ...init });
        assert.equal(init.redirect, "manual");
        assert.equal(init.cache, "no-store");
        if (url.endsWith("/api/auth/login")) return Response.json({}, { headers: { "Set-Cookie": "diagrammatic_session=fixture; HttpOnly" } });
        if (url.endsWith("/api/auth/logout")) { logouts++; return Response.json({}); }
        const release = releases[Math.min(probes++, releases.length - 1)];
        return typeof release === "number" ? new Response(null, { status: release }) : Response.json(release);
      }, ...options,
    }),
  };
}

test("healthy old revisions and same-commit different builds cannot pass release acceptance", async () => {
  for (const wrong of [{ ...expected, revision: "b".repeat(40) }, { ...expected, buildId: "00000000-0000-4000-8000-000000000002" }]) {
    const h = harness([wrong]);
    await assert.rejects(h.run(), /healthy older instance does not pass/);
    assert.equal(h.probes, 6);
    assert.equal(h.logouts, 1);
  }
});

test("rollout waits for three consecutive exact build identities and resets on old or unavailable instances", async () => {
  const h = harness([404, expected, { ...expected, revision: "b".repeat(40) }, expected, expected, expected]);
  assert.deepEqual(await h.run(), expected);
  assert.equal(h.probes, 6);
  assert.equal(h.logouts, 1);
});

test("missing, malformed and unauthorized release responses never pass", async () => {
  for (const value of [503, 401, { version: "old" }, { ...expected, revision: "short" }]) {
    const h = harness([value]);
    await assert.rejects(h.run(), /not observed|failed|invalid/);
    assert.equal(h.logouts, 1);
  }
});

test("manifest reading fails closed and ignores runtime revision environment", () => {
  const root = mkdtempSync(join(tmpdir(), "diagrammatic-release-"));
  const prior = process.env.GITHUB_SHA;
  try {
    assert.throws(() => readReleaseInfo(root));
    mkdirSync(join(root, "content"));
    writeFileSync(join(root, "content", "release.json"), JSON.stringify(expected));
    process.env.GITHUB_SHA = "f".repeat(40);
    assert.deepEqual(readReleaseInfo(root), expected);
    assert.throws(() => parseReleaseInfo({ ...expected, buildId: "not-a-uuid" }), /invalid/);
    writeFileSync(join(root, "content", "release.json"), "{");
    assert.throws(() => readReleaseInfo(root));
  } finally {
    if (prior === undefined) delete process.env.GITHUB_SHA; else process.env.GITHUB_SHA = prior;
    rmSync(root, { recursive: true, force: true });
  }
});

test("build identity refuses a mismatched checkout before writing a manifest", () => {
  assert.throws(() => buildReleaseInfo({ expected: "0".repeat(40) }), /does not match/);
});

test("production version route is no-store and fails explicitly when the manifest is unavailable", async () => {
  const source = readFileSync(new URL("../app/api/version/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const broken of [false, true]) {
    const exports = {};
    const errors = [];
    vm.runInNewContext(compiled, {
      exports, console: { error: (message) => errors.push(message) },
      require: (id) => {
        if (id === "next/server") return { NextResponse };
        if (id === "@/lib/release-info.mjs") return { readReleaseInfo: () => {
          if (broken) throw new Error("missing");
          return expected;
        } };
        throw new Error(`Unexpected dependency ${id}`);
      },
    });
    const response = await exports.GET();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.status, broken ? 503 : 200);
    assert.equal(errors.length, broken ? 1 : 0);
    if (!broken) assert.deepEqual(await response.json(), expected);
  }
});

test("release gate includes native recovery and AI contracts without live inference suites", () => {
  const files = releaseBrowserSuites.flatMap((suite) => suite.files);
  for (const needed of ["screenshot-regressions.spec.ts", "architecture-roundtrip.spec.ts", "whiteboard-conversion.spec.ts", "ai-streaming.spec.ts", "engineering-validation.spec.ts"]) {
    assert.ok(files.includes(needed));
  }
  assert.ok(files.every((file) => !file.startsWith("live-")));
  assert.ok(releaseBrowserSuites.some(({ projects }) => projects.includes("firefox") && projects.includes("webkit")));
});
