import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as flow from "@xyflow/react";

const source = readFileSync(new URL("../components/diagrammatic/modes/architecture/ArchitectureCanvas.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const payload = {
  nodes: [
    { id: "boundary", kind: "group", label: "Compute", tier: "Compute", x: 0, y: 0, width: 440, height: 220 },
    { id: "api", kind: "shape", shape: "rectangle", label: "API", x: 30, y: 60, parentId: "boundary" },
    { id: "db", kind: "shape", shape: "database", label: "Database", x: 600, y: 60 },
  ],
  edges: [{ id: "request", source: "api", target: "db", label: "HTTPS", style: "flow", step: 1 }],
};

function harness() {
  const slots = [];
  const styles = [];
  let index = 0;
  let tree;
  const ref = { current: null };
  const instance = { screenToFlowPosition: (position) => position, fitView: () => {} };
  const react = {
    createContext: (value) => ({ Provider: "Provider", value }),
    useContext: (context) => context.value,
    forwardRef: (render) => render,
    memo: (component) => component,
    useCallback: (callback) => callback,
    useEffect: () => {},
    useRef: (initial) => {
      const key = index++;
      slots[key] ??= { current: initial };
      return slots[key];
    },
    useState: (initial) => {
      const key = index++;
      slots[key] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[key].value, (next) => { slots[key].value = typeof next === "function" ? next(slots[key].value) : next; }];
    },
    useImperativeHandle: (handle, factory) => { handle.current = factory(); },
  };
  const dependencies = {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "@xyflow/react": { ...flow, ReactFlow: "ReactFlow", useReactFlow: () => instance },
    "lucide-react": Object.fromEntries(["Box", "Circle", "Database", "Diamond", "FileText", "Globe2", "Square", "UserRound"].map((name) => [name, name])),
  };
  const exports = {};
  vm.runInNewContext(`${compiled}\nexports.CanvasUnderTest = CanvasInner;`, {
    exports, window: { innerWidth: 1440, innerHeight: 1000 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setTimeout, clearTimeout,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected canvas dependency: ${name}`);
      return dependencies[name];
    },
  });
  function render() {
    index = 0;
    tree = exports.CanvasUnderTest({ value: payload, onEdgeStyleChange: (style) => styles.push(style) }, ref);
  }
  function flowProps() {
    return tree.props.children.props.children.props;
  }
  render();
  flowProps().onInit(instance);
  render();
  return {
    get handle() { return ref.current; },
    get props() { return flowProps(); },
    styles, render,
    changeNodes(changes) { flowProps().onNodesChange(changes); render(); },
  };
}

test("one resize gesture restores dimensions and position in one undo and redo", () => {
  const h = harness();
  h.changeNodes([{ id: "boundary", type: "dimensions", resizing: true }]);
  h.changeNodes([
    { id: "boundary", type: "dimensions", resizing: true, dimensions: { width: 500, height: 280 }, setAttributes: true },
    { id: "boundary", type: "position", position: { x: -60, y: -60 } },
  ]);
  h.changeNodes([{ id: "boundary", type: "dimensions", resizing: true, dimensions: { width: 800, height: 400 }, setAttributes: true }]);
  h.changeNodes([{ id: "boundary", type: "dimensions", resizing: false }]);
  assert.equal(h.handle.serialize().nodes[0].width, 800);
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().nodes[0].width, 440);
  assert.equal(h.handle.serialize().nodes[0].height, 220);
  assert.equal(h.handle.serialize().nodes[0].x, 0);
  h.handle.redo(); h.render();
  assert.equal(h.handle.serialize().nodes[0].width, 800);
  h.handle.undo(); h.render();
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().nodes.length, 3);
  assert.equal(h.handle.serialize().nodes[0].width, 440);
});

test("layout measurements do not create user history entries", () => {
  const h = harness();
  h.changeNodes([{ id: "boundary", type: "dimensions", dimensions: { width: 441, height: 221 } }]);
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().nodes[0].width, 441);
});

test("bulk styles are one undoable action and restore the default style without losing edge metadata", () => {
  const h = harness();
  h.handle.setAllEdgeStyle("solid"); h.render();
  assert.equal(h.handle.serialize().edges[0].style, "solid");
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().edges[0].style, "flow");
  assert.equal(h.styles.at(-1), "flow");
  h.handle.redo(); h.render();
  assert.equal(h.handle.serialize().edges[0].style, "solid");
  assert.equal(h.styles.at(-1), "solid");
  assert.equal(h.handle.serialize().edges[0].label, "HTTPS");
  assert.equal(h.handle.serialize().edges[0].step, 1);
});

test("a new bulk edit after undo clears the stale redo branch and no-op styles add no history", () => {
  const h = harness();
  h.handle.setAllEdgeStyle("solid"); h.render();
  h.handle.undo(); h.render();
  h.handle.setAllEdgeStyle("dashed"); h.render();
  h.handle.setAllEdgeStyle("dashed"); h.render();
  h.handle.redo(); h.render();
  assert.equal(h.handle.serialize().edges[0].style, "dashed");
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().edges[0].style, "flow");
});

test("batched node and edge removals have one checkpoint, not two identical undo entries", () => {
  const h = harness();
  h.handle.addShapeAtCenter("rectangle"); h.render();
  const added = h.handle.serialize().nodes.at(-1).id;
  h.props.onNodesChange([{ id: "api", type: "remove" }]);
  h.props.onEdgesChange([{ id: "request", type: "remove" }]);
  h.render();
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().edges.length, 1);
  assert.equal(h.handle.serialize().nodes.length, 4);
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().nodes.some((node) => node.id === added), false);
  assert.equal(h.handle.serialize().nodes.length, 3);
});
