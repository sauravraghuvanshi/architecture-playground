import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/export-raster.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

for (const fails of [false, true]) {
  test(`PNG raster backing store is released on ${fails ? "failure" : "success"}`, async () => {
    const failure = new Error("Encoder failure");
    const canvas = { width: 2400, height: 1800, toDataURL: (mime) => {
      assert.equal(mime, "image/png");
      if (fails) throw failure;
      return "data:image/png;base64,fixture";
    } };
    const exports = {};
    const node = {};
    const options = { pixelRatio: 2, fontEmbedCSS: "@font-face{}" };
    vm.runInNewContext(compiled, { exports, require: (name) => {
      assert.equal(name, "html-to-image");
      return { toCanvas: async (actualNode, actualOptions) => {
        assert.equal(actualNode, node);
        assert.equal(actualOptions, options);
        return canvas;
      } };
    } });
    if (fails) await assert.rejects(exports.toExportPng(node, options), (error) => error === failure);
    else assert.equal(await exports.toExportPng(node, options), "data:image/png;base64,fixture");
    assert.equal(canvas.width, 0);
    assert.equal(canvas.height, 0);
  });
}
