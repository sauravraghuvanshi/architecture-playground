import assert from "node:assert/strict";
import test from "node:test";
import { mayContainDiagramDrag, readDiagramDrag, writeDiagramDrag } from "../lib/diagram-drag.ts";

function transfer() {
  const values = new Map();
  return { values, setData: (type, value) => values.set(type, value), getData: (type) => values.get(type) ?? "", get types() { return [...values.keys()]; }, effectAllowed: "none" };
}

for (const kind of ["icon", "shape", "whiteboard", "playground"]) {
  test(`${kind} survives transports that keep only standard text MIME`, () => {
    const source = transfer();
    const payload = kind === "whiteboard" ? JSON.stringify({ svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', label: "User" }) : "fixture";
    writeDiagramDrag(source, kind, payload);
    assert.equal(readDiagramDrag(source, kind), payload);
    assert.equal(source.effectAllowed, "copy");
    for (const type of source.types) if (type !== "text/plain") source.values.delete(type);
    assert.equal(mayContainDiagramDrag(source, kind), true);
    assert.equal(readDiagramDrag(source, kind), payload);
    assert.equal(readDiagramDrag(source, kind === "icon" ? "shape" : "icon"), "");
  });
}

test("ordinary external text is not interpreted as an application drag", () => {
  const source = transfer();
  source.setData("text/plain", '{"svg":"external note"}');
  assert.equal(readDiagramDrag(source, "whiteboard"), "");
});

test("marked malformed and over-budget payloads fail explicitly", () => {
  const source = transfer();
  for (const text of ['diagrammatic-drag-v1:{broken', 'diagrammatic-drag-v1:{"mime":true,"data":"x"}']) {
    source.setData("text/plain", text);
    assert.throws(() => readDiagramDrag(source, "whiteboard"), /malformed/);
  }
  assert.throws(() => writeDiagramDrag(source, "icon", "x".repeat(1_000_001)), /large/);
  source.setData("application/x-diagrammatic-icon", "x".repeat(1_000_001));
  assert.throws(() => readDiagramDrag(source, "icon"), /large/);
});
