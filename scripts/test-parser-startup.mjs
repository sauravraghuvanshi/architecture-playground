import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import ts from "typescript";
import { z } from "zod";

function harness() {
  const timers = new Map();
  let nextTimer = 0;
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  const writes = [];
  const kills = [];
  child.stdin.end = (input) => writes.push(input);
  child.kill = (signal) => { kills.push(signal); queueMicrotask(() => child.emit("close", null)); };
  const dependencies = {
    "node:child_process": { spawn: (_file, args) => { assert.deepEqual([...args], ["--ready"]); return child; } },
    "node:fs": { existsSync: () => true }, "node:path": path, zod: { z },
  };
  const source = readFileSync(new URL("../lib/artifact-parser.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Buffer, process: { platform: process.platform, cwd: process.cwd, env: {} },
    setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
    require: (id) => { if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`); return dependencies[id]; },
  });
  return { parse: exports.parseArtifactSyntax, child, writes, kills, timers };
}
test("Bicep startup gets a separate bounded window before any untrusted input or processing clock", async () => {
  const h = harness();
  const promise = h.parse("param name string", "bicep");
  assert.equal(h.writes.length, 0);
  assert.equal([...h.timers.values()][0].ms, 15000);
  h.child.stdout.emit("data", Buffer.from("DIAGRAMMATIC_PARSER_"));
  assert.equal(h.writes.length, 0);
  h.child.stdout.emit("data", Buffer.from("READY_V1\r\n"));
  assert.equal(h.writes.length, 1);
  assert.equal(JSON.parse(h.writes[0]).code, "param name string");
  assert.equal([...h.timers.values()][0].ms, 5000);
  h.child.stdout.emit("data", Buffer.from(JSON.stringify({ parser: "azure-bicep-parser", version: "0.47.16", valid: true, complete: true, diagnostics: [], body: { attributes: [], blocks: [] } })));
  h.child.emit("close", 0);
  assert.equal((await promise).valid, true);
  assert.equal(h.timers.size, 0);
});
test("startup and processing timeouts remain distinct and terminate only the owned child", async () => {
  for (const started of [false, true]) {
    const h = harness();
    const promise = h.parse("param name string", "bicep");
    if (started) h.child.stdout.emit("data", Buffer.from("DIAGRAMMATIC_PARSER_READY_V1\n"));
    [...h.timers.values()][0].callback();
    await assert.rejects(promise, (error) => error.code === (started ? "timeout" : "startup-timeout"));
    assert.deepEqual(h.kills, ["SIGKILL"]);
    assert.equal(h.writes.length, started ? 1 : 0);
  }
});
test("malformed readiness and cancellation cannot produce validation success", async () => {
  const h = harness();
  const promise = h.parse("untrusted", "bicep");
  h.child.stdout.emit("data", Buffer.from("NOT_READY\n"));
  await assert.rejects(promise, (error) => error.code === "protocol");
  assert.equal(h.writes.length, 0);
  const cancelled = harness();
  const controller = new AbortController();
  const pending = cancelled.parse("untrusted", "bicep", controller.signal);
  controller.abort();
  await assert.rejects(pending, (error) => error.code === "cancelled");
  assert.equal(cancelled.writes.length, 0);
});
