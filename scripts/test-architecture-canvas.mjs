import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as flow from "@xyflow/react";
import { MAX_PLAYBACK_STEP, parseArchitectureDocument } from "../lib/architecture-document.ts";
import * as hierarchy from "../lib/architecture-hierarchy.ts";

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

function harness(initialPayload = payload) {
  const slots = [];
  const styles = [];
  const errors = [];
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
    "@/lib/architecture-document": { MAX_PLAYBACK_STEP, parseArchitectureDocument },
    "@/lib/architecture-hierarchy": hierarchy,
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
    tree = exports.CanvasUnderTest({ value: initialPayload, onEdgeStyleChange: (style) => styles.push(style), onError: (message) => errors.push(message) }, ref);
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
    styles, errors, render,
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
  const beforeUndo = JSON.stringify(h.handle.serialize());
  h.handle.undo(); h.render();
  assert.equal(JSON.stringify(h.handle.serialize()), beforeUndo);
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

test("native canvas round trips every connection side through hydration and serialization", () => {
  for (const sourceHandle of ["top", "right", "bottom", "left", null]) {
    for (const targetHandle of ["top", "right", "bottom", "left", null]) {
      const input = { ...payload, edges: [{ ...payload.edges[0], sourceHandle, targetHandle, step: 900 }] };
      const h = harness(input);
      const saved = JSON.parse(JSON.stringify(h.handle.serialize()));
      assert.deepEqual(saved.edges, input.edges);
      h.handle.hydrate(saved); h.render();
      assert.deepEqual(JSON.parse(JSON.stringify(h.handle.serialize())).edges, input.edges);
    }
  }
});

test("explicit icon and shape geometry survives measured rounding without changing identity", () => {
  const input = {
    nodes: [
      { id: "icon", kind: "icon", label: "Sized service", subtitle: "Owner", iconId: "azure/test", iconPath: "/cloud-icons/azure/test.svg", x: 10.25, y: 20.5, width: 180.5, height: 140.25 },
      { id: "shape", kind: "shape", shape: "rectangle", label: "Sized primitive", x: 350.25, y: 20.5, width: 200.5, height: 130.25 },
    ],
    edges: [],
  };
  const h = harness(input);
  h.changeNodes([
    { id: "icon", type: "dimensions", dimensions: { width: 181, height: 140 } },
    { id: "shape", type: "dimensions", dimensions: { width: 201, height: 130 } },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(h.handle.serialize())), input);
});

test("parents are hydrated before children without changing parent-relative coordinates", () => {
  const input = { ...payload, nodes: [payload.nodes[1], payload.nodes[0], payload.nodes[2]] };
  const h = harness(input);
  assert.equal(h.props.nodes[0].id, "boundary");
  const child = h.handle.serialize().nodes.find((node) => node.id === "api");
  assert.equal(child.parentId, "boundary");
  assert.equal(child.x, 30);
  assert.equal(child.y, 60);
});

test("invalid native hydration leaves the active graph and undo stack unchanged", () => {
  const h = harness();
  const original = JSON.stringify(h.handle.serialize());
  assert.throws(() => h.handle.hydrate({ ...payload, edges: [{ id: "bad", source: "missing", target: "db" }] }));
  h.render();
  assert.equal(JSON.stringify(h.handle.serialize()), original);
  h.handle.undo(); h.render();
  assert.equal(JSON.stringify(h.handle.serialize()), original);
});

test("editing or assigning stages cannot create an architecture that its own importer rejects", () => {
  const input = { ...payload, edges: [{ ...payload.edges[0], step: MAX_PLAYBACK_STEP }] };
  const h = harness(input);
  for (const step of [0, 1.5, Infinity, MAX_PLAYBACK_STEP + 1]) h.handle.updateElement("request", { step });
  h.props.onConnect({ source: "db", target: "api", sourceHandle: "bottom", targetHandle: "top" });
  h.render();
  assert.equal(h.errors.length, 5);
  assert.equal(h.handle.serialize().edges.length, 1);
  assert.equal(h.handle.serialize().edges[0].step, MAX_PLAYBACK_STEP);
  assert.doesNotThrow(() => parseArchitectureDocument(h.handle.serialize()));
});

test("user resize measurements become declared dimensions without rounding unrelated nodes", () => {
  const input = {
    ...payload,
    nodes: payload.nodes.map((node) => node.id === "api" ? { ...node, width: 128.5, height: 104.25 } : node),
  };
  const h = harness(input);
  h.changeNodes([{ id: "boundary", type: "dimensions", resizing: true }]);
  h.changeNodes([
    { id: "boundary", type: "dimensions", dimensions: { width: 580, height: 320 } },
    { id: "api", type: "dimensions", dimensions: { width: 129, height: 104 } },
  ]);
  h.changeNodes([{ id: "boundary", type: "dimensions", resizing: false }]);
  assert.equal(h.handle.serialize().nodes[0].width, 580);
  assert.equal(h.handle.serialize().nodes[1].width, 128.5);
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().nodes[0].width, 440);
});

const nested = {
  nodes: [
    { id: "app", kind: "shape", shape: "rectangle", label: "App", x: 40, y: 70, width: 128, height: 104, parentId: "subnet" },
    { id: "subnet", kind: "group", label: "Apps", tier: "Subnet", x: 30, y: 80, width: 500, height: 300, parentId: "vnet" },
    { id: "vnet", kind: "group", label: "Workload network", tier: "Virtual Network", x: 50, y: 90, width: 750, height: 500, parentId: "lz" },
    { id: "lz", kind: "group", label: "Production", tier: "Landing Zone", x: 200, y: 100, width: 1000, height: 750 },
    { id: "outside", kind: "shape", shape: "person", label: "Client", x: -100, y: 200, width: 128, height: 104 },
  ],
  edges: [{ id: "https", source: "outside", target: "app", sourceHandle: "right", targetHandle: "left", label: "HTTPS", style: "solid", step: 1 }],
};

test("nested boundaries round trip parent-first with unchanged positions, types and connections", () => {
  const h = harness(nested);
  const serialized = JSON.parse(JSON.stringify(h.handle.serialize()));
  assert.deepEqual(serialized.nodes.map((node) => node.id), ["lz", "vnet", "subnet", "app", "outside"]);
  for (const node of nested.nodes) assert.deepEqual(serialized.nodes.find((item) => item.id === node.id), node);
  assert.deepEqual(serialized.edges, nested.edges);
  assert.deepEqual(hierarchy.absolutePosition(h.props.nodes.find((node) => node.id === "app"), h.props.nodes), { x: 320, y: 340 });
  assert.equal(hierarchy.boundaryAtPoint(h.props.nodes, 350, 360).id, "subnet");
  h.handle.hydrate(serialized); h.render();
  assert.deepEqual(JSON.parse(JSON.stringify(h.handle.serialize())), serialized);
});

test("reparent and detach are atomic undoable operations that preserve subtree geometry", () => {
  const h = harness(nested);
  h.handle.updateElement("subnet", { parentId: "lz" }); h.render();
  const moved = h.handle.serialize().nodes.find((node) => node.id === "subnet");
  assert.equal(moved.parentId, "lz");
  assert.equal(moved.x, 80); assert.equal(moved.y, 170);
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().nodes.find((node) => node.id === "subnet").parentId, "vnet");
  h.handle.redo(); h.render();
  h.handle.updateElement("subnet", { parentId: null }); h.render();
  const detached = h.handle.serialize().nodes.find((node) => node.id === "subnet");
  assert.equal(detached.parentId, undefined);
  assert.equal(detached.x, 280); assert.equal(detached.y, 270);
  assert.equal(h.handle.serialize().nodes.find((node) => node.id === "app").parentId, "subnet");
});

test("cycles, self-parenting and invalid parents are rejected before canvas and history mutation", () => {
  const h = harness(nested);
  const before = JSON.stringify(h.handle.serialize());
  for (const parentId of ["subnet", "lz", "missing", "outside"]) {
    h.handle.updateElement("lz", { parentId }); h.render();
  }
  assert.equal(h.errors.length, 4);
  assert.equal(JSON.stringify(h.handle.serialize()), before);
  h.handle.undo(); h.render();
  assert.equal(JSON.stringify(h.handle.serialize()), before);
  assert.throws(() => parseArchitectureDocument({
    ...nested, nodes: nested.nodes.map((node) => node.id === "lz" ? { ...node, parentId: "subnet" } : node),
  }), /cycle/);
  assert.throws(() => hierarchy.parentFirst([{ id: "duplicate" }, { id: "duplicate" }]), /unique/);
});

test("toolbar and keyboard deletions remove the full subtree and touching edges; undo restores it", () => {
  for (const keyboard of [false, true]) {
    const h = harness(nested);
    const before = JSON.stringify(h.handle.serialize());
    if (keyboard) h.changeNodes([{ type: "remove", id: "lz" }]);
    else {
      h.changeNodes([{ type: "select", id: "lz", selected: true }]);
      h.handle.deleteSelection(); h.render();
    }
    assert.equal(h.handle.serialize().nodes.length, 1);
    assert.equal(h.handle.serialize().nodes[0].id, "outside");
    assert.equal(h.handle.serialize().edges.length, 0);
    h.handle.undo(); h.render();
    assert.equal(JSON.stringify(h.handle.serialize()), before);
  }
});

test("adding boundaries and services uses selected parent with valid inset and expandable bounds", () => {
  const h = harness({ nodes: [], edges: [] });
  h.handle.addGroup("Production", "Landing Zone"); h.render();
  const lz = h.handle.serialize().nodes[0];
  h.handle.addGroup("Private network", "Virtual Network"); h.render();
  const vnet = h.handle.serialize().nodes.at(-1);
  assert.equal(vnet.parentId, lz.id);
  h.handle.addGroup("Apps", "Subnet"); h.render();
  const subnet = h.handle.serialize().nodes.at(-1);
  assert.equal(subnet.parentId, vnet.id);
  h.handle.addShapeAtCenter("rectangle"); h.render();
  const app = h.handle.serialize().nodes.at(-1);
  assert.equal(app.parentId, subnet.id);
  assert.ok(app.x >= 24 && app.y >= 56);
  assert.doesNotThrow(() => parseArchitectureDocument(h.handle.serialize()));
});

test("dropping on a nested group uses absolute ancestors, never negative parent coordinates", () => {
  const h = harness(nested);
  h.handle.dropShape("database", 285, 310); h.render();
  const added = h.handle.serialize().nodes.at(-1);
  assert.equal(added.parentId, "subnet");
  assert.ok(added.x >= 24 && added.y >= 56);
  h.handle.undo(); h.render();
  assert.equal(h.handle.serialize().nodes.length, nested.nodes.length);
});

test("resizing a subnet expands its ancestors in the same undo checkpoint", () => {
  const h = harness(nested);
  const before = JSON.stringify(h.handle.serialize());
  h.changeNodes([{ id: "subnet", type: "dimensions", resizing: true, dimensions: { width: 1100, height: 900 } }]);
  h.changeNodes([{ id: "subnet", type: "dimensions", resizing: false }]);
  const graph = h.handle.serialize();
  const subnet = graph.nodes.find((node) => node.id === "subnet");
  const vnet = graph.nodes.find((node) => node.id === "vnet");
  const lz = graph.nodes.find((node) => node.id === "lz");
  assert.ok(vnet.width >= subnet.x + subnet.width + 24);
  assert.ok(vnet.height >= subnet.y + subnet.height + 24);
  assert.ok(lz.width >= vnet.x + vnet.width + 24);
  h.handle.undo(); h.render();
  assert.equal(JSON.stringify(h.handle.serialize()), before);
});

test("dragging a nested component outside all boundaries detaches it with one undo", () => {
  const h = harness(nested);
  const before = JSON.stringify(h.handle.serialize());
  h.changeNodes([{ id: "app", type: "position", dragging: true, position: { x: 1600, y: 80 } }]);
  const moved = h.props.nodes.find((node) => node.id === "app");
  h.props.onNodeDragStop({}, moved, [moved]); h.render();
  const app = h.handle.serialize().nodes.find((node) => node.id === "app");
  assert.equal(app.parentId, undefined);
  assert.equal(app.x, 1880);
  h.handle.undo(); h.render();
  assert.equal(JSON.stringify(h.handle.serialize()), before);
});
