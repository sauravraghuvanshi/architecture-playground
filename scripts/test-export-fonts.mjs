import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/export-fonts.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness({ response = () => new Response("font-fixture", { headers: { "content-type": "font/woff2" } }) } = {}) {
  const calls = [];
  const exported = {};
  class Reader {
    result = null;
    readAsDataURL(blob) {
      void blob.arrayBuffer().then((bytes) => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
        this.onload();
      });
    }
  }
  vm.runInNewContext(compiled, {
    exports: exported, URL, Blob, Uint8Array, DOMException, AbortController, setTimeout, clearTimeout,
    FileReader: Reader, CSSRule: { FONT_FACE_RULE: 5, IMPORT_RULE: 3 },
    fetch: async (url, options) => { calls.push({ url, options }); return response(); },
  });
  return { getCss: exported.getExportFontCss, calls };
}

function fixture() {
  const sheet = { href: "https://app.invalid/assets/fonts.css", cssRules: [] };
  function face(family = "Geist", src = 'url("./face.woff2") format("woff2")') {
    const style = { getPropertyValue: (name) => name === "font-family" ? family : name === "src" ? src : "" };
    Object.defineProperty(style, "fontFamily", { get: () => { throw new Error("Firefox descriptors have no camel-case fontFamily"); } });
    return { type: 5, parentStyleSheet: sheet, style, cssText: `@font-face { font-family: ${family}; src: ${src}; font-weight: 100 900; }` };
  }
  sheet.cssRules.push({ type: 4, cssRules: [face(), face("Geist", 'local("Arial")'), face("Unused")] }, face());
  const document = {
    baseURI: "https://app.invalid/diagrammatic",
    styleSheets: [sheet],
    defaultView: { getComputedStyle: () => ({ getPropertyValue: () => '"Geist", sans-serif' }) },
  };
  return { ownerDocument: document, querySelectorAll: () => [] };
}

test("font export uses standard descriptor access, preserves faces and embeds each used resource once", async () => {
  const { getCss, calls } = harness();
  const css = await getCss(fixture());
  assert.match(css, /data:font\/woff2;base64/);
  assert.match(css, /font-weight: 100 900/);
  assert.match(css, /local\("Arial"\)/);
  assert.doesNotMatch(css, /Unused/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://app.invalid/assets/face.woff2");
  assert.equal(calls[0].options.referrerPolicy, "no-referrer");
});

test("failed, empty and oversized font resources cannot produce success-shaped CSS", async () => {
  for (const response of [
    () => new Response("missing", { status: 404 }),
    () => new Response(""),
    () => new Response("x", { headers: { "content-length": String(2 * 1024 * 1024 + 1) } }),
    () => new Response("x".repeat(2 * 1024 * 1024 + 1)),
  ]) await assert.rejects(harness({ response }).getCss(fixture()), /font/i);
});

test("unreadable stylesheet access is surfaced instead of silently dropping fonts", async () => {
  const root = fixture();
  Object.defineProperty(root.ownerDocument.styleSheets[0], "cssRules", { get() { throw new DOMException("blocked", "SecurityError"); } });
  await assert.rejects(harness().getCss(root), /stylesheet cannot be read/);
});

test("generic local fonts need no remote resource and detached documents fail explicitly", async () => {
  const root = fixture();
  root.ownerDocument.defaultView.getComputedStyle = () => ({ getPropertyValue: () => "sans-serif" });
  const { getCss, calls } = harness();
  assert.equal(await getCss(root), "");
  assert.equal(calls.length, 0);
  root.ownerDocument.defaultView = null;
  await assert.rejects(getCss(root), /active document/);
});

test("export filtering removes only interactive chrome and retains real nodes labels and paths", () => {
  const source = readFileSync(new URL("../lib/export-filter.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  class Element {
    constructor(name) { this.classList = { contains: (value) => value === name }; }
  }
  const exports = {};
  vm.runInNewContext(compiled, { exports, Element });
  for (const name of ["react-flow__minimap", "react-flow__controls", "react-flow__attribution", "react-flow__handle", "react-flow__resize-control", "react-flow__edge-interaction"]) {
    assert.equal(exports.includeDiagramExportNode(new Element(name)), false);
  }
  for (const name of ["react-flow__node", "react-flow__edge-path", "react-flow__edgelabel-renderer"]) {
    assert.equal(exports.includeDiagramExportNode(new Element(name)), true);
  }
});
