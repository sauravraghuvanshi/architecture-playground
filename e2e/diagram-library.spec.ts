import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import type * as DiagramLibrary from "../lib/diagram-library";

declare global {
  interface Window { diagramLibrary: typeof DiagramLibrary }
}

const source = readFileSync(join(process.cwd(), "lib", "diagram-library.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test.beforeEach(async ({ page }) => {
  // Exercise real IndexedDB in an isolated origin without contacting the shared app server.
  await page.route("https://diagram-library.test/**", (route) => route.fulfill({
    contentType: "text/html", body: "<!doctype html><html><body>Diagram library persistence harness</body></html>",
  }));
  await page.goto("https://diagram-library.test/");
  await page.addScriptTag({ content: `{const exports = {}; ${compiled}\nwindow.diagramLibrary = exports;}` });
});

test("multiple documents retain large Whiteboard binaries and isolated metadata across reload", async ({ page }) => {
  const saved = await page.evaluate(async () => {
    localStorage.setItem("diagrammatic.draft.whiteboard", "legacy draft must remain");
    const api = window.diagramLibrary;
    const whiteboard = await api.saveDiagram({
      name: "Workshop", mode: "whiteboard", canvasTheme: "dark",
      payload: { elements: [{ id: "image", type: "image" }], files: { image: { dataURL: "data:image/png;base64," + "A".repeat(6 * 1024 * 1024) } } },
      comments: [{ id: "c1", body: "Customer note", author: "Architect", createdAt: 1 }],
      versions: [{ id: "v1", label: "Starting point", payload: { elements: [] }, createdAt: 2 }],
    });
    const architecture = await api.saveDiagram({
      name: "Service architecture", mode: "architecture", canvasTheme: "light",
      payload: { nodes: [{ id: "api" }], edges: [] },
    });
    return { whiteboard: whiteboard.id, architecture: architecture.id };
  });
  expect(saved.whiteboard).not.toBe(saved.architecture);
  await page.reload();
  await page.addScriptTag({ content: `{const exports = {}; ${compiled}\nwindow.diagramLibrary = exports;}` });
  const result = await page.evaluate(async (ids) => {
    const first = await window.diagramLibrary.loadDiagram(ids.whiteboard);
    const second = await window.diagramLibrary.loadDiagram(ids.architecture);
    const board = first.payload as { files: { image: { dataURL: string } } };
    return {
      binaryLength: board.files.image.dataURL.length,
      boardComments: first.comments, boardVersions: first.versions.length,
      architectureComments: second.comments, architectureTheme: second.canvasTheme,
      summaries: await window.diagramLibrary.listDiagrams(),
      legacy: localStorage.getItem("diagrammatic.draft.whiteboard"),
    };
  }, saved);
  expect(result.binaryLength).toBe(6 * 1024 * 1024 + "data:image/png;base64,".length);
  expect(result.boardComments[0].body).toBe("Customer note");
  expect(result.boardVersions).toBe(1);
  expect(result.architectureComments).toEqual([]);
  expect(result.architectureTheme).toBe("light");
  expect(result.summaries).toHaveLength(2);
  expect(result.summaries.every((entry) => !("payload" in entry))).toBe(true);
  expect(result.legacy).toBe("legacy draft must remain");
});

test("save, rename and delete preserve isolation and reject stale updates", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = window.diagramLibrary;
    const input = { name: "Same name", mode: "architecture" as const, payload: { nodes: [] }, canvasTheme: "light" as const };
    const first = await api.saveDiagram({ ...input, comments: [{ id: "c", body: "Keep", author: "Me", createdAt: 1 }] });
    const second = await api.saveDiagram(input);
    const updated = await api.saveDiagram({ ...input, id: first.id, payload: { nodes: [{ id: "new" }] }, expectedRevision: first.revision });
    const renamed = await api.renameDiagram(first.id, "Renamed diagram", updated.revision);
    let conflict = "";
    try { await api.saveDiagram({ ...input, id: first.id, expectedRevision: first.revision }); }
    catch (error) { conflict = error instanceof api.DiagramLibraryError ? error.code : "unexpected"; }
    await api.deleteDiagram(second.id, second.revision);
    let missing = "";
    try { await api.loadDiagram(second.id); }
    catch (error) { missing = error instanceof api.DiagramLibraryError ? error.code : "unexpected"; }
    const loaded = await api.loadDiagram(first.id);
    loaded.comments[0].body = "Only mutate this returned copy";
    return {
      sameId: first.id === renamed.id, createdAtUnchanged: first.createdAt === renamed.createdAt,
      revision: renamed.revision, comments: (await api.loadDiagram(first.id)).comments,
      listed: await api.listDiagrams(), conflict, missing,
    };
  });
  expect(result.sameId).toBe(true);
  expect(result.createdAtUnchanged).toBe(true);
  expect(result.revision).toBe(3);
  expect(result.comments[0].body).toBe("Keep");
  expect(result.listed).toHaveLength(1);
  expect(result.listed[0].name).toBe("Renamed diagram");
  expect(result.conflict).toBe("conflict");
  expect(result.missing).toBe("not-found");
});

test("failed summary writes roll back the document and surface quota errors", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = window.diagramLibrary;
    const input = { name: "Before", mode: "architecture" as const, payload: { nodes: [] }, canvasTheme: "light" as const };
    const saved = await api.saveDiagram(input);
    const originalPut = IDBObjectStore.prototype.put;
    let code = "";
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "summaries") throw new DOMException("Injected quota failure", "QuotaExceededError");
      return originalPut.call(this, value, key);
    };
    try {
      await api.saveDiagram({ ...input, id: saved.id, name: "Must roll back", expectedRevision: saved.revision });
    } catch (error) {
      code = error instanceof api.DiagramLibraryError ? error.code : "unexpected";
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
    return { code, document: await api.loadDiagram(saved.id), summaries: await api.listDiagrams() };
  });
  expect(result.code).toBe("quota");
  expect(result.document.name).toBe("Before");
  expect(result.document.revision).toBe(1);
  expect(result.summaries[0].name).toBe("Before");
});

test("concurrent revision-checked saves cannot overwrite one another silently", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = window.diagramLibrary;
    const input = { name: "Original", mode: "kanban" as const, payload: { columns: [] }, canvasTheme: "dark" as const };
    const saved = await api.saveDiagram(input);
    const attempts = await Promise.allSettled([
      api.saveDiagram({ ...input, id: saved.id, name: "First tab", expectedRevision: saved.revision }),
      api.saveDiagram({ ...input, id: saved.id, name: "Second tab", expectedRevision: saved.revision }),
    ]);
    return {
      statuses: attempts.map((entry) => entry.status),
      failures: attempts.filter((entry) => entry.status === "rejected").map((entry) => entry.reason.code),
      current: await api.loadDiagram(saved.id),
    };
  });
  expect(result.statuses.filter((status) => status === "fulfilled")).toHaveLength(1);
  expect(result.failures).toEqual(["conflict"]);
  expect(result.current.revision).toBe(2);
});
