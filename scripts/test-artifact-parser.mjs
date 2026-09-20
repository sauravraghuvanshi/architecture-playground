import assert from "node:assert/strict";
import test from "node:test";
import { parseArtifactSyntax, ArtifactParserError } from "../lib/artifact-parser.ts";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("HCL adapter parses structure without interpreting filesystem or remote-module expressions", async () => {
  const result = await parseArtifactSyntax(`
module "never_fetch" {
  source = "https://example.invalid/never-fetch-this-module"
}
locals {
  content = file("/file-that-must-not-be-read")
}
resource "azurerm_linux_web_app" "app" {
  name = "app"
}
`, "terraform");
  assert.equal(result.valid, true);
  assert.equal(result.parser, "hashicorp-hcl");
  assert.equal(result.version, "2.25.0");
  assert.deepEqual(result.body.blocks.map((block) => block.type), ["module", "locals", "resource"]);
  assert.deepEqual(result.body.blocks[1].body.attributes[0].value, {
    kind: "call", text: "file", items: [{ kind: "string", text: "/file-that-must-not-be-read" }],
  });
});

test("the real HCL parser rejects duplicate attributes and invalid single-line blocks", async () => {
  for (const code of ['variable "x" { type = string default = "bad" }', 'x = 1\nx = 2\n', 'not hcl {{{']) {
    const result = await parseArtifactSyntax(code, "terraform");
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.length);
    assert.equal(result.body, undefined);
  }
});

test("pre-cancelled validation cannot start a parser and missing helpers do not become success", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(parseArtifactSyntax("x = 1", "terraform", controller.signal), (error) =>
    error instanceof ArtifactParserError && error.code === "cancelled");
  const previous = process.env.DIAGRAMMATIC_VALIDATOR_ROOT;
  try {
    process.env.DIAGRAMMATIC_VALIDATOR_ROOT = "__missing-validator-for-test__";
    await assert.rejects(parseArtifactSyntax("x = 1", "terraform"), (error) =>
      error instanceof ArtifactParserError && error.code === "unavailable");
  } finally {
    if (previous === undefined) delete process.env.DIAGRAMMATIC_VALIDATOR_ROOT;
    else process.env.DIAGRAMMATIC_VALIDATOR_ROOT = previous;
  }
});

test("parser concurrency is bounded and capacity is returned after completion", async () => {
  const results = await Promise.allSettled([
    parseArtifactSyntax("a = 1", "terraform"),
    parseArtifactSyntax("b = 2", "terraform"),
    parseArtifactSyntax("c = 3", "terraform"),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
  assert.ok(results.some((result) => result.status === "rejected" && result.reason.code === "busy"));
  assert.equal((await parseArtifactSyntax("d = 4", "terraform")).valid, true);
});

test("Bicep lexer/parser rejects malformed declarations without loading file expressions", async () => {
  const result = await parseArtifactSyntax("var content = loadTextContent('/must-not-be-opened')\n", "bicep");
  assert.equal(result.valid, true);
  assert.equal(result.body.blocks[0].body.attributes[0].value.kind, "call");
  for (const code of ["THIS IS NOT BICEP {{{", "var a = 'unterminated", "var a = 1 var b = 2"]) {
    const invalid = await parseArtifactSyntax(code, "bicep");
    assert.equal(invalid.valid, false);
    assert.ok(invalid.diagnostics.length);
  }
});

test("Bash syntax checking neither executes script commands nor inherits startup hooks, and rejects heredoc warnings", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "artifact-bash-"));
  const marker = path.join(directory, "must-not-exist");
  const startup = path.join(directory, "startup.sh");
  const prior = process.env.BASH_ENV;
  const shellMarker = marker.replaceAll("\\", "/");
  writeFileSync(startup, `printf 'startup executed' > '${shellMarker}'\n`);
  process.env.BASH_ENV = startup;
  try {
    const valid = await parseArtifactSyntax(`printf 'script executed' > '${shellMarker}'\n`, "azure-cli");
    assert.equal(valid.valid, true);
    assert.equal(existsSync(marker), false);
    assert.equal((await parseArtifactSyntax("cat <<EOF\nnever terminated\n", "azure-cli")).valid, false);
    assert.equal((await parseArtifactSyntax("if then\n", "azure-cli")).valid, false);
  } finally {
    if (prior === undefined) delete process.env.BASH_ENV; else process.env.BASH_ENV = prior;
    rmSync(directory, { recursive: true, force: true });
  }
});
