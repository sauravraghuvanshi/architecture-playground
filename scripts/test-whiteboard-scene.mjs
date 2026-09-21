import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import sharp from "sharp";
import {
  parseWhiteboardScene,
  whiteboardSceneSchema,
  WhiteboardSceneValidationError,
  WHITEBOARD_SCENE_LIMITS as limits,
  WHITEBOARD_VOLATILE_APP_STATE_KEYS,
  getWhiteboardSceneTransientElementIds,
} from "../lib/whiteboard-scene.ts";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgqLjyHwAEFAJMURtfXQAAAABJRU5ErkJggg==";
const file = (id = "pixels", dataURL = png, mimeType = "image/png") => ({ id, mimeType, dataURL, created: 1, lastRetrieved: 2, version: 1 });
const shape = (id = "box", type = "rectangle", extra = {}) => {
  const points = ["line", "arrow"].includes(type) && Array.isArray(extra.points) && extra.points.every(Array.isArray) ? extra.points : null;
  const dimensions = points?.length ? {
    width: Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)),
    height: Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y)),
  } : {};
  return { id, type, x: 17.25, y: -50.5, width: 123.125, height: 89.5, ...dimensions, ...extra };
};
const scene = (...elements) => ({ elements, files: {} });
const asSvg = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const svgScene = (svg) => ({ elements: [shape("icon", "image", { fileId: "svg" })], files: { svg: file("svg", asSvg(svg), "image/svg+xml") } });
const simpleSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#0f172a" d="M0 0h24v24H0z"/></svg>';
function rejects(input, code) {
  assert.throws(() => parseWhiteboardScene(input), (error) => {
    assert.ok(error instanceof WhiteboardSceneValidationError, `${error}`);
    if (code) assert.equal(error.code, code);
    assert.match(error.message, /Invalid Whiteboard scene at/);
    assert.ok(Array.isArray(error.path));
    return true;
  });
}

test("canonical empty and minimal legacy scenes have deterministic, nonmutating migrations", () => {
  assert.deepEqual(parseWhiteboardScene({ elements: [] }), { elements: [] });
  const input = scene(shape());
  const before = structuredClone(input);
  const result = parseWhiteboardScene(input);
  assert.deepEqual(input, before);
  for (const key of ["x", "y", "width", "height"]) assert.equal(result.elements[0][key], input.elements[0][key]);
  assert.equal(result.elements[0].angle, 0);
  assert.equal(result.elements[0].isDeleted, false);
  assert.deepEqual(result.elements[0].groupIds, []);
  assert.deepEqual(parseWhiteboardScene(result), result);
  const legacy = parseWhiteboardScene({
    elements: [shape("text", "text", { text: "A\nB" }), shape("stroke", "line", { points: [[0, 0], [-12, 50]] })],
    appState: { collaborators: {}, followedBy: {}, gridSize: null },
  });
  assert.deepEqual(legacy.appState, { gridSize: null });
  assert.equal(legacy.elements[0].originalText, "A\nB");
  assert.deepEqual(legacy.elements[1].points, [[0, 0], [-12, 50]]);
  const ancient = parseWhiteboardScene(scene(shape("old", "draw"), shape("text", "text", { text: "Hello", font: "24px Helvetica" })));
  assert.equal(ancient.elements[0].type, "line");
  assert.deepEqual(ancient.elements[0].points, [[0, 0], [123.125, 89.5]]);
  assert.equal(ancient.elements[1].fontSize, 24);
  assert.equal(ancient.elements[1].fontFamily, 2);
  assert.equal(ancient.elements[1].lineHeight, 89.5 / 24);
});

test("complete native Excalidraw 0.18.1 fields preserve geometry, metadata, and bindings exactly", () => {
  const common = {
    angle: 0.3490658503988659, strokeColor: "#ff1234", backgroundColor: "#ffffff",
    fillStyle: "cross-hatch", strokeWidth: 2.5, strokeStyle: "dashed", roughness: 1,
    opacity: 73, seed: 2147480000, version: 7, versionNonce: -1234567, index: "a0",
    isDeleted: false, groupIds: [], frameId: null, boundElements: null, updated: 1720000000000,
    link: null, locked: false, roundness: { type: 3 }, customData: { evidence: ["retain me"], score: 0.7 },
  };
  const native = (id, type, extra = {}) => shape(id, type, { ...structuredClone(common), ...extra });
  const input = {
    elements: [
      native("frame", "frame", { name: "Workload", width: 900, height: 700 }),
      native("box", "rectangle", { frameId: "frame", groupIds: ["inner", "outer"], boundElements: [{ id: "label", type: "text" }, { id: "arrow", type: "arrow" }] }),
      native("label", "text", { frameId: "frame", groupIds: ["inner", "outer"], containerId: "box", text: "Wrapped\nlabel", originalText: "Wrapped label", autoResize: false, fontFamily: 5, fontSize: 20, lineHeight: 1.25, textAlign: "center", verticalAlign: "middle" }),
      native("target", "ellipse", { boundElements: [{ id: "arrow", type: "arrow" }] }),
      native("arrow", "arrow", { points: [[0, 0], [37.4, 56.8], [240, 12]], width: 240, height: 56.8, lastCommittedPoint: null, startBinding: { elementId: "box", focus: 0.45, gap: 7 }, endBinding: { elementId: "target", focus: -0.23, gap: 3 }, startArrowhead: null, endArrowhead: "triangle_outline", elbowed: false }),
      native("ink", "freedraw", { points: [[0, 0], [1.25, 2.5], [4, 3]], pressures: [0.1, 0.5, 1], simulatePressure: false, lastCommittedPoint: [4, 3] }),
      native("bitmap", "image", { fileId: "pixels", status: "saved", scale: [-1, 1], crop: { x: 2, y: 3, width: 10, height: 11, naturalWidth: 20, naturalHeight: 30 } }),
      native("icon", "image", { fileId: "svg", status: "saved", scale: [1, 1], crop: null }),
      native("magic", "magicframe", { name: null }),
      native("diamond", "diamond"),
      native("embed", "embeddable", { link: "https://example.test" }),
      native("iframe", "iframe", { customData: { generationData: { status: "done", html: "<p>Preserved metadata</p>" } } }),
    ],
    files: { pixels: file(), svg: file("svg", asSvg(simpleSvg), "image/svg+xml") },
    appState: { theme: "dark", zoom: { value: 1.25 }, scrollX: -12.5, scrollY: 400, exportBackground: true, viewBackgroundColor: "#f8fafc", frameRendering: { enabled: true, clip: true, name: true, outline: false }, currentItemArrowType: "elbow", selectedElementIds: { box: true }, futureMetadata: { label: "preserved" } },
    type: "excalidraw", version: 2, source: "fixture",
  };
  const result = parseWhiteboardScene(input);
  const expected = structuredClone(input);
  delete expected.appState.selectedElementIds;
  assert.deepEqual(result, expected);
  assert.notEqual(result.elements[0].customData, input.elements[0].customData);
  assert.deepEqual(whiteboardSceneSchema.parse(input), result);
});

test("elbow bindings require finite fixed points and valid fixed segments", () => {
  const input = scene(shape("box"), shape("elbow", "arrow", {
    elbowed: true, points: [[0, 0], [50, 0], [50, 80]],
    startBinding: { elementId: "box", focus: 0, gap: 2, fixedPoint: [1, 0.5] },
    fixedSegments: [{ index: 1, start: [0, 0], end: [50, 0] }],
    startIsSpecial: false, endIsSpecial: null,
  }));
  assert.deepEqual(parseWhiteboardScene(input).elements[1].fixedSegments, input.elements[1].fixedSegments);
  for (const mutation of [
    (element) => { delete element.startBinding.fixedPoint; },
    (element) => { element.startBinding.fixedPoint = null; },
    (element) => { element.startBinding.fixedPoint = [Infinity, 0]; },
    (element) => { element.fixedSegments[0].index = 999; },
    (element) => { element.fixedSegments[0].start = [NaN, 2]; },
  ]) { const bad = structuredClone(input); mutation(bad.elements[1]); rejects(bad); }
});

function nativeBindingEngine() {
  const manifest = JSON.parse(readFileSync(new URL("../node_modules/@excalidraw/excalidraw/package.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "0.18.1", "Recheck executable binding fixtures when Excalidraw is upgraded");
  const source = readFileSync(new URL("../node_modules/@excalidraw/excalidraw/dist/dev/chunk-4FTI6OG3.js", import.meta.url), "utf8");
  const names = [
    "DEFAULT_ELEMENT_PROPS", "_newElementBase", "newElement", "newArrowElement",
    "ROUNDNESS", "DEFAULT_PROPORTIONAL_RADIUS", "DEFAULT_ADAPTIVE_RADIUS",
    "FIXED_BINDING_DISTANCE", "BINDING_HIGHLIGHT_THICKNESS", "BINDING_HIGHLIGHT_OFFSET",
    "HEADING_RIGHT", "HEADING_DOWN", "HEADING_LEFT", "HEADING_UP", "vectorToHeading", "compareHeading",
    "isArrowElement", "isElbowArrow", "isFixedPointBinding", "isRectanguloidElement",
    "arrayToMap", "getCornerRadius", "deconstructRectanguloidElement",
    "intersectElementWithLineSegment", "intersectRectanguloidWithLineSegment",
    "aabbForElement", "getCenterForBounds", "avoidRectangularCorner", "headingToMidBindPoint",
    "bindPointToSnapToElementOutline", "calculateFixedPointForElbowArrowBinding", "normalizeFixedPoint",
    "getGlobalFixedPointForBindableElement", "getGlobalFixedPoints", "bindLinearElement", "repairBinding",
    "determineFocusDistance", "distanceToBindableElement", "distanceToRectanguloidElement",
    "maxBindingGap", "normalizePointBinding",
  ];
  const declarations = names.map((name) => {
    const start = [`var ${name} =`, `function ${name}(`].map((prefix) => source.indexOf(prefix)).find((offset) => offset >= 0);
    assert.notEqual(start, undefined, `Missing installed native declaration ${name}`);
    const next = /\n(?:var |function |class |import |export )/g;
    next.lastIndex = start + 1;
    const end = next.exec(source)?.index;
    assert.ok(end > start, `Missing declaration boundary for ${name}`);
    return source.slice(start, end);
  });
  const mathStart = source.indexOf("// ../math/utils.ts");
  const mathEnd = source.indexOf("// utils.ts", mathStart);
  assert.ok(mathStart >= 0 && mathEnd > mathStart);
  let nextId = 0;
  // All geometry, binding calculation, and binding repair execute installed
  // implementations. Only factory entropy/palette and scene mutation notifications
  // are replaced; no coordinate calculation or normalization is mocked.
  return vm.runInNewContext(`${source.slice(mathStart, mathEnd)}\n${declarations.join("\n")}\n({${names.join(",")}, pointRotateRads})`, {
    COLOR_PALETTE: { black: "#1b1b1f", transparent: "transparent" },
    ROUGHNESS: { artist: 1 },
    randomId: () => `binding-native-${++nextId}`,
    randomInteger: () => 123456,
    getUpdatedTimestamp: () => 1720000000000,
    mutateElement: (element, updates) => Object.assign(element, updates),
  });
}

test("installed elbow binding calculations preserve outside-outline ratios at both endpoints", () => {
  const engine = nativeBindingEngine();
  for (const [width, height, angle] of [[200, 100, 0], [200, 100, Math.PI / 6], [1_000_000, 1_000_000, 0], [0.000001, 100, 0]]) {
    const center = [0, 0];
    const offsets = [[-width / 2 - 5, 0], [width / 2 + 5, 0], [0, -height / 2 - 5], [0, height / 2 + 5]];
    for (const [side, location] of offsets.entries()) {
      const box = engine.newElement({ type: "rectangle", x: -width / 2, y: -height / 2, width, height, angle });
      const [x, y] = engine.pointRotateRads(location, center, angle);
      const elbow = engine.newArrowElement({ type: "arrow", elbowed: true, x, y, width: 20, height: 0, points: [[0, 0], [20, 0]] });
      const elementsMap = new Map([[box.id, box], [elbow.id, elbow]]);
      engine.bindLinearElement(elbow, box, "start", elementsMap);
      const ratio = elbow.startBinding.fixedPoint[side < 2 ? 0 : 1];
      assert.ok(side % 2 === 0 ? ratio < 0 : ratio > 1, `Native side ${side} ratio ${ratio} must cross the old boundary`);
      if (width === 1_000_000) assert.ok(Math.abs(ratio - (side % 2)) < 0.00001, "Native ratios can be just outside 0/1");
      if (width === 0.000001 && side < 2) assert.ok(Math.abs(ratio) > limits.coordinate, "Ratios are not scene-space coordinates");
      // Move the other endpoint onto the same actual native outline location.
      elbow.x -= 20;
      engine.bindLinearElement(elbow, box, "end", elementsMap);
      const input = scene(box, elbow);
      const before = JSON.parse(JSON.stringify(input));
      const result = parseWhiteboardScene(input);
      for (const key of ["startBinding", "endBinding"]) assert.deepEqual(result.elements[1][key], before.elements[1][key]);
      assert.deepEqual(JSON.parse(JSON.stringify(input)), before, "Validation cannot mutate native geometry");
      assert.deepEqual(parseWhiteboardScene(JSON.parse(JSON.stringify(result))), result);
    }
  }
});

test("real native two-ended elbow bindings roundtrip without moving or losing attachments", () => {
  const engine = nativeBindingEngine();
  const left = engine.newElement({ type: "rectangle", x: 40, y: 60, width: 200, height: 100 });
  const right = engine.newElement({ type: "rectangle", x: 500, y: 200, width: 200, height: 100 });
  const elbow = engine.newArrowElement({
    type: "arrow", elbowed: true, x: 245, y: 110, width: 250, height: 140,
    points: [[0, 0], [125, 0], [125, 140], [250, 140]],
    fixedSegments: [{ index: 2, start: [125, 0], end: [125, 140] }],
    endArrowhead: "arrow",
  });
  const elementsMap = new Map([left, right, elbow].map((item) => [item.id, item]));
  engine.bindLinearElement(elbow, left, "start", elementsMap);
  engine.bindLinearElement(elbow, right, "end", elementsMap);
  assert.deepEqual(Array.from(elbow.startBinding.fixedPoint), [1.025, 0.5001]);
  assert.deepEqual(Array.from(elbow.endBinding.fixedPoint), [-0.025, 0.5001]);
  const nativePoints = JSON.parse(JSON.stringify(engine.getGlobalFixedPoints(elbow, elementsMap)));
  const input = scene(left, right, elbow);
  const saved = parseWhiteboardScene(input);
  const reopened = parseWhiteboardScene(JSON.parse(JSON.stringify(saved)));
  const restoredArrow = reopened.elements[2];
  for (const key of ["startBinding", "endBinding"]) {
    const repaired = engine.repairBinding(restoredArrow, restoredArrow[key]);
    assert.deepEqual(JSON.parse(JSON.stringify(repaired)), restoredArrow[key], "Native restoration must retain the complete binding");
  }
  const reopenedMap = new Map(reopened.elements.map((item) => [item.id, item]));
  assert.deepEqual(JSON.parse(JSON.stringify(engine.getGlobalFixedPoints(restoredArrow, reopenedMap))), nativePoints);
  for (const key of ["x", "y", "width", "height", "points", "fixedSegments", "startBinding", "endBinding"]) {
    assert.deepEqual(restoredArrow[key], JSON.parse(JSON.stringify(elbow[key])), key);
  }
  assert.deepEqual(reopened, saved);
});

test("native focus ratios and non-elbow optional/null fixedPoint survive capture and repair", () => {
  const engine = nativeBindingEngine();
  const box = engine.newElement({ type: "rectangle", x: 0, y: 0, width: 100, height: 100 });
  for (const y of [-5, 105]) {
    const focus = engine.determineFocusDistance(box, [200, y], [105, y]);
    assert.ok(Math.abs(focus) > 1, `Native focus ${focus} is not confined to [-1,1]`);
    const gap = engine.distanceToBindableElement(box, [105, y]);
    const binding = { elementId: box.id, ...engine.normalizePointBinding({ focus, gap }, box) };
    for (const extra of [{}, { fixedPoint: null }, { fixedPoint: [1.025, -0.025] }]) {
      const arrow = engine.newArrowElement({ type: "arrow", x: 105, y, width: 95, height: 0, points: [[0, 0], [95, 0]] });
      arrow.startBinding = { ...binding, ...extra };
      arrow.endBinding = { ...binding, ...extra };
      const input = scene(box, arrow);
      const saved = parseWhiteboardScene(input);
      for (const key of ["startBinding", "endBinding"]) {
        assert.deepEqual(saved.elements[1][key], arrow[key]);
        assert.deepEqual(JSON.parse(JSON.stringify(engine.repairBinding(arrow, arrow[key]))), arrow[key]);
      }
      assert.deepEqual(parseWhiteboardScene(JSON.parse(JSON.stringify(saved))), saved);
    }
  }
});

test("binding compatibility retains finite/shape/null/reference guards", () => {
  for (const elbowed of [false, true]) for (const key of ["startBinding", "endBinding"]) {
    const input = scene(shape("box"), shape("arrow", "arrow", {
      elbowed, points: [[0, 0], [30, 0]], [key]: { elementId: "box", focus: 0, gap: 0, fixedPoint: [-0.025, 1.025] },
    }));
    assert.doesNotThrow(() => parseWhiteboardScene(input));
    const unbound = structuredClone(input);
    unbound.elements[1][key] = null;
    assert.equal(parseWhiteboardScene(unbound).elements[1][key], null);
    for (const badPoint of [[], [0], [0, 1, 2], "0,1", {}, [null, 0], [0, "1"], [NaN, 0], [0, Infinity], [-Infinity, 0]]) {
      const bad = structuredClone(input);
      bad.elements[1][key].fixedPoint = badPoint;
      rejects(bad);
    }
    for (const field of ["focus", "gap"]) for (const value of [null, "0", {}, NaN, Infinity, -Infinity]) {
      const bad = structuredClone(input);
      bad.elements[1][key][field] = value;
      rejects(bad);
    }
    for (const field of ["focus", "gap", "elementId"]) {
      const bad = structuredClone(input);
      delete bad.elements[1][key][field];
      rejects(bad);
    }
    const negativeGap = structuredClone(input);
    negativeGap.elements[1][key].gap = -0.001;
    rejects(negativeGap);
    for (const invalidBinding of [[], 1, "box"]) {
      const bad = structuredClone(input);
      bad.elements[1][key] = invalidBinding;
      rejects(bad);
    }
    if (elbowed) {
      for (const value of [null, undefined]) {
        const bad = structuredClone(input);
        if (value === undefined) delete bad.elements[1][key].fixedPoint;
        else bad.elements[1][key].fixedPoint = value;
        rejects(bad, "invalid_element");
      }
    }
  }
});

test("formerly accepted corrupt elements and explicit malformed defaults are rejected", () => {
  for (const input of [null, {}, [], "{}", { elements: {} }, { elements: null }, scene(null), scene(42), scene({}), scene(shape("bad", "unknown")), scene(shape("selection", "selection"))]) rejects(input);
  for (const [key, value] of Object.entries({
    id: "", x: "12", y: null, width: -1, height: Infinity, angle: NaN,
    opacity: 101, seed: 0.2, version: -1, versionNonce: "random",
    groupIds: "group", frameId: 1, boundElements: {}, isDeleted: "false",
    locked: 0, strokeWidth: -1, roundness: { type: 55 }, customData: [],
    strokeColor: false, fillStyle: "invented", index: {},
  })) rejects(scene(shape("bad", "rectangle", { [key]: value })));
  for (const value of [NaN, Infinity, -Infinity, limits.coordinate + 1, -limits.coordinate - 1]) rejects(scene(shape("bad", "rectangle", { x: value })));
  for (const missing of ["id", "x", "y", "width", "height"]) {
    const input = shape(); delete input[missing]; rejects(scene(input));
  }
  rejects(scene(shape("same"), shape("same", "ellipse")), "duplicate_id");
  rejects(scene(shape("same"), shape("same", "rectangle", { isDeleted: true })), "duplicate_id");
});

test("shape-specific points, text, pressure, image and crop invariants reject corruption", () => {
  for (const points of [null, [[0, 0], [1]], [[0, 0], [1, NaN]], [[0, 0], ["2", 4]], [[0, 0], [1, 2, 3]]]) rejects(scene(shape("line", "line", { points })));
  for (const extra of [{ text: 42 }, { text: "hello", fontSize: 0 }, { text: "hello", originalText: null }, { text: "hello", lineHeight: 0 }, { text: "hello", autoResize: "yes" }]) rejects(scene(shape("t", "text", extra)));
  rejects(scene(shape("line", "line", { points: [[0, 0]], width: 20, height: 0 })));
  rejects(scene(shape("line", "line", { width: 200, points: [[0, 0], [20, 20]] })));
  rejects(scene(shape("line", "line", { points: [[1, 1], [20, 20]] })));
  rejects(scene(shape("t", "text", { text: "Hello", font: "20px UnknownFont" })));
  rejects(scene(shape("t", "text", { text: "Hello", font: "20px Virgil", fontSize: 24 })));
  for (const extra of [{ pressures: [2] }, { pressures: [] }, { pressures: [0.4], simulatePressure: "yes" }]) rejects(scene(shape("f", "freedraw", { points: [[0, 0]], simulatePressure: false, ...extra })));
  for (const extra of [{ fileId: null }, { scale: [0, 1] }, { scale: [1] }, { status: "broken" }, { crop: { x: 2, y: 0, width: 3, height: 3, naturalWidth: 4, naturalHeight: 4 } }]) rejects({ elements: [shape("image", "image", { fileId: "pixels", ...extra })], files: { pixels: file() } });
});

test("dangling, incorrectly typed, self, deleted and inconsistent references fail", () => {
  const arrow = (extra = {}) => shape("arrow", "arrow", { points: [[0, 0], [10, 10]], ...extra });
  const binding = (elementId) => ({ elementId, focus: 0, gap: 1 });
  for (const input of [
    scene(shape("image", "image", { fileId: "absent" })),
    scene(arrow({ startBinding: binding("absent") })),
    scene(arrow({ endBinding: binding("arrow") })),
    scene(shape("line", "line", { points: [[0, 0], [10, 10]] }), arrow({ endBinding: binding("line") })),
    scene(shape("text", "text", { text: "A", containerId: "absent" })),
    scene(shape("box", "rectangle", { frameId: "absent" })),
    scene(shape("box", "rectangle", { frameId: "other" }), shape("other")),
    scene(shape("f", "frame", { frameId: "f" })),
    scene(shape("f", "frame", { frameId: "g" }), shape("g", "frame", { frameId: "f" })),
    scene(shape("box", "rectangle", { boundElements: [{ id: "absent", type: "text" }] })),
    scene(shape("box", "rectangle", { boundElements: [{ id: "arrow", type: "text" }] }), arrow()),
    scene(shape("box", "rectangle", { boundElements: [{ id: "arrow", type: "arrow" }] }), arrow()),
    scene(shape("box", "rectangle", { groupIds: ["same", "same"] })),
    scene(shape("box", "rectangle", { groupIds: ["box"] })),
    scene(shape("a", "rectangle", { groupIds: ["inner", "outer"] }), shape("b", "rectangle", { groupIds: ["inner"] })),
  ]) rejects(input, "invalid_reference");
});

test("valid deleted tombstones retain missing references and absent binaries without being dropped", () => {
  const input = scene(
    shape("removed", "image", { isDeleted: true, fileId: "lost", frameId: "gone" }),
    shape("pending", "image", { isDeleted: true, fileId: null }),
    shape("arrow", "arrow", { isDeleted: true, points: [[0, 0], [2, 2]], startBinding: { elementId: "gone", focus: 0, gap: 0 } }),
  );
  assert.equal(parseWhiteboardScene(input).elements.length, 3);
  rejects(scene(shape("removed", "rectangle", { isDeleted: true, x: NaN })));
});

test("actual installed Excalidraw constructors emit valid transitional capture data", () => {
  const manifest = JSON.parse(readFileSync(new URL("../node_modules/@excalidraw/excalidraw/package.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, "0.18.1", "Recheck the native contract when Excalidraw is upgraded");
  const source = readFileSync(new URL("../node_modules/@excalidraw/excalidraw/dist/dev/chunk-4FTI6OG3.js", import.meta.url), "utf8");
  const names = ["DEFAULT_ELEMENT_PROPS", "_newElementBase", "newElement", "newElementWith", "newImageElement", "newFreeDrawElement", "newLinearElement", "newArrowElement", "newFrameElement"];
  // Execute the installed engine's real factory implementations, not lookalike
  // fixtures. Only clocks/randomness and referenced palette constants are fixed.
  const factories = names.map((name) => {
    const start = source.indexOf(`var ${name} =`);
    assert.ok(start >= 0, `Missing installed native factory ${name}`);
    const end = source.indexOf("\nvar ", start + 1);
    assert.ok(end > start);
    return source.slice(start, end);
  }).join("\n");
  let nextId = 0;
  const native = vm.runInNewContext(`${factories}\n({${names.join(",")}})`, {
    COLOR_PALETTE: { black: "#1b1b1f", transparent: "transparent" },
    ROUGHNESS: { artist: 1 },
    randomId: () => `native-${++nextId}`,
    randomInteger: () => 123456,
    getUpdatedTimestamp: () => 1720000000000,
    console,
  });
  const options = { x: 40, y: 60 };
  const pending = native.newImageElement(options);
  const drawing = native.newElement({ ...options, type: "rectangle" });
  const frame = native.newFrameElement(options);
  const freehand = native.newFreeDrawElement({ ...options, type: "freedraw", points: [[0, 0]], pressures: [0.5], simulatePressure: false });
  const arrow = native.newArrowElement({ ...options, type: "arrow", points: [[0, 0]] });
  const line = native.newLinearElement({ ...options, type: "line" });
  const direct = { elements: [pending, drawing, frame, freehand, arrow, line], files: {}, appState: { collaborators: new Map(), followedBy: new Set() } };
  const captured = parseWhiteboardScene(direct);
  assert.deepEqual(captured.elements.map((item) => item.id), direct.elements.map((item) => item.id));
  assert.deepEqual(getWhiteboardSceneTransientElementIds(captured), direct.elements.map((item) => item.id));
  assert.equal(captured.elements[0].fileId, null);
  assert.equal(captured.elements[0].status, "pending");
  assert.equal("customData" in captured.elements[0], false, "Native optional undefined has normal JSON omission semantics");
  assert.deepEqual(parseWhiteboardScene(JSON.parse(JSON.stringify(direct))), captured);

  const box = native.newElementWith(drawing, { width: 200, height: 100, boundElements: [{ id: arrow.id, type: "arrow" }] });
  const bound = native.newElementWith(arrow, {
    width: 150, height: 50, points: [[0, 0], [150, 50]],
    startBinding: { elementId: box.id, focus: 0, gap: 5 },
  });
  const settled = {
    elements: [
      box, bound,
      native.newElementWith(frame, { width: 500, height: 400 }),
      native.newElementWith(freehand, { width: 10, height: 15, points: [[0, 0], [10, 15]], pressures: [0.5, 0.7] }),
      native.newElementWith(pending, { width: 64, height: 64, status: "saved", fileId: "pixels" }),
    ],
    files: { pixels: file() },
  };
  const restored = parseWhiteboardScene(settled);
  assert.deepEqual(getWhiteboardSceneTransientElementIds(restored), []);
  assert.deepEqual(restored.elements.map(({ x, y, width, height }) => ({ x, y, width, height })), settled.elements.map(({ x, y, width, height }) => ({ x, y, width, height })));
  settled.elements[0] = native.newElementWith(box, { isDeleted: true });
  assert.equal(parseWhiteboardScene(settled).elements[1].startBinding.elementId, box.id, "Existing typed tombstones may remain referenced during deletion");
  delete settled.files.pixels;
  rejects(settled, "invalid_reference");
  const invalidPending = { elements: [native.newElementWith(pending, { status: "saved" })] };
  rejects(invalidPending, "invalid_element");
});

test("transient IDs flag unfinished content but preserve horizontal and vertical paths", () => {
  const parsed = parseWhiteboardScene(scene(
    shape("horizontal", "line", { points: [[0, 0], [100, 0]] }),
    shape("vertical", "arrow", { points: [[0, 0], [0, 100]] }),
    shape("horizontal-ink", "freedraw", { width: 100, height: 0, points: [[0, 0], [100, 0]] }),
    shape("vertical-ink", "freedraw", { width: 0, height: 100, points: [[0, 0], [0, 100]] }),
    shape("zero-length", "line", { points: [[0, 0], [0, 0]] }),
    shape("first-point", "freedraw", { width: 0, height: 0, points: [[0, 0]] }),
    shape("empty-frame", "frame", { width: 0, height: 0 }),
    shape("empty-text", "text", { text: "" }),
    shape("pending-image", "image", { fileId: null, status: "pending" }),
    shape("failed-image", "image", { fileId: null, status: "error" }),
    shape("deleted-zero", "rectangle", { width: 0, height: 0, isDeleted: true }),
  ));
  const before = structuredClone(parsed);
  assert.deepEqual(getWhiteboardSceneTransientElementIds(parsed), [
    "zero-length", "first-point", "empty-frame", "empty-text", "pending-image",
  ]);
  assert.deepEqual(parsed, before, "classification is read-only");
  assert.deepEqual(getWhiteboardSceneTransientElementIds(parseWhiteboardScene({ elements: [] })), []);
});

test("malformed persisted appState types fail before restoration", () => {
  for (const appState of [null, [], "state", { zoom: 1 }, { zoom: { value: 0 } }, { zoom: { value: NaN } },
    { scrollX: "1" }, { scrollY: Infinity }, { theme: {} }, { viewBackgroundColor: {} },
    { exportBackground: "true" }, { currentItemFontSize: 0 }, { currentItemStrokeWidth: -1 },
    { frameRendering: { clip: "true" } }, { hoveredElementIds: [] }, { previousSelectedElementIds: { x: 1 } },
    { collaborators: [] }, { collaborators: { peer: {} } }, { followedBy: ["peer"] },
    { gridSize: -1 }, { currentItemEndArrowhead: "bad" },
    { stats: { open: "yes", panels: 0 } }, { snapLines: {} }, { name: {} },
  ]) rejects({ elements: [], appState });
  const result = whiteboardSceneSchema.safeParse({ elements: [], appState: { zoom: { value: 0 } } });
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues[0].path, ["appState", "zoom", "value"]);
  assert.equal(result.error.issues[0].params.sceneCode, "invalid_app_state");
});

test("historical transient editor artifacts are omitted, not rejected or handed to restoration", () => {
  const persisted = { zoom: { value: 1.25 }, scrollX: 20, viewBackgroundColor: "#fff", customPreference: "preserved" };
  for (const artifact of [{}, { id: "stale" }, [], null, false, "legacy artifact"]) {
    const input = {
      elements: [shape()],
      appState: {
        ...persisted,
        ...Object.fromEntries(WHITEBOARD_VOLATILE_APP_STATE_KEYS.map((key) => [key, artifact])),
        collaborators: {},
        followedBy: {},
      },
    };
    const before = structuredClone(input);
    assert.deepEqual(parseWhiteboardScene(input).appState, persisted);
    assert.deepEqual(input, before, "migration must not mutate the recoverable source");
    assert.deepEqual(whiteboardSceneSchema.parse(input).appState, persisted);
  }
  rejects({ elements: [], appState: { activeTool: { ignored: true }, zoom: { value: 0 } } }, "invalid_app_state");
  rejects({ elements: [shape("bad", "rectangle", { x: NaN })], appState: { newElement: {} } });
  let transient = {}; for (let index = 0; index <= limits.depth; index++) transient = { nested: transient };
  rejects({ elements: [], appState: { editingLinearElement: transient } }, "limit_exceeded");
});

test("binary IDs, MIME types, canonical base64, size and raster headers are mandatory", () => {
  for (const extra of [
    { id: "different" }, { created: "yesterday" }, { created: -1 }, { mimeType: "image/jpeg" },
    { mimeType: "text/html" }, { dataURL: "https://example.test/image.png" },
    { dataURL: png + " " }, { dataURL: png.replace(/==$/, "=") },
    { dataURL: "data:image/png;base64,AA==" }, { dataURL: "data:image/png;base64,AB==" },
    { dataURL: "data:image/png;base64,invalid!" }, { size: 1 }, { version: [] },
  ]) rejects({ elements: [], files: { pixels: { ...file(), ...extra } } }, "invalid_file");
  rejects({ elements: [], files: [] }, "invalid_file");
  const valid = file();
  valid.size = Buffer.from(png.split(",")[1], "base64").length;
  assert.deepEqual(parseWhiteboardScene({ elements: [], files: { pixels: valid } }).files.pixels, valid);
  for (const mutate of [
    (bytes) => bytes.subarray(0, 20),
    (bytes) => { bytes.writeUInt32BE(999999, 16); return bytes; },
    (bytes) => { bytes.writeUInt32BE(0, 20); return bytes; },
    (bytes) => { bytes[0] = 0; return bytes; },
    (bytes) => { bytes[24] = 7; return bytes; },
    (bytes) => { bytes[25] = 55; return bytes; },
    (bytes) => { bytes[29] ^= 1; return bytes; },
  ]) {
    const bytes = mutate(Buffer.from(png.split(",")[1], "base64"));
    rejects({ elements: [], files: { pixels: file("pixels", `data:image/png;base64,${bytes.toString("base64")}`) } }, "invalid_file");
  }
});

test("real JPEG and WebP image files pass their synchronous headers without pixel decoding", async () => {
  for (const format of ["jpeg", "webp"]) {
    const bytes = await sharp({ create: { width: 2, height: 3, channels: 3, background: "#123456" } }).toFormat(format).toBuffer();
    const image = file(format, `data:image/${format};base64,${bytes.toString("base64")}`, `image/${format}`);
    assert.deepEqual(parseWhiteboardScene({ elements: [shape("image", "image", { fileId: format })], files: { [format]: image } }).files[format], image);
    rejects({ elements: [], files: { [format]: { ...image, dataURL: `data:image/${format};base64,${bytes.subarray(0, 12).toString("base64")}` } } }, "invalid_file");
  }
});

function bmpFixture(width = 2, height = 3) {
  const stride = Math.ceil(width * 3 / 4) * 4;
  const bytes = Buffer.alloc(54 + stride * height);
  bytes.write("BM"); bytes.writeUInt32LE(bytes.length, 2); bytes.writeUInt32LE(54, 10);
  bytes.writeUInt32LE(40, 14); bytes.writeInt32LE(width, 18); bytes.writeInt32LE(height, 22);
  bytes.writeUInt16LE(1, 26); bytes.writeUInt16LE(24, 28);
  bytes.writeUInt32LE(stride * height, 34);
  bytes.fill(0x88, 54);
  return bytes;
}
function icoFixture(image, width = 2, height = 3) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header[6] = width; header[7] = height;
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(image.length, 14); header.writeUInt32LE(22, 18);
  return Buffer.concat([header, image]);
}
const encodedFile = (mimeType, bytes, id = "native") => file(id, `data:${mimeType};base64,${bytes.toString("base64")}`, mimeType);

test("genuine GIF, BMP, PNG/DIB ICO, AVIF and JFIF scenes preserve native bytes and metadata", async () => {
  const image = () => sharp({ create: { width: 2, height: 3, channels: 3, background: "#123456" } });
  const dib = bmpFixture().subarray(14);
  dib.writeInt32LE(6, 8); // ICO DIB height contains both XOR pixels and AND mask.
  const dibWithMask = Buffer.concat([dib, Buffer.alloc(12)]);
  const fixtures = [
    ["image/gif", await image().gif().toBuffer()],
    ["image/bmp", bmpFixture()],
    ["image/x-icon", icoFixture(await image().png().toBuffer())],
    ["image/x-icon", icoFixture(dibWithMask)],
    ["image/avif", await image().avif().toBuffer()],
    ["image/jfif", await image().jpeg().toBuffer()],
  ];
  for (const [mime, bytes] of fixtures) {
    const binary = encodedFile(mime, bytes);
    const input = { elements: [shape("native", "image", { fileId: "native" })], files: { native: binary } };
    assert.deepEqual(parseWhiteboardScene(input).files.native, binary, mime);
    assert.deepEqual(input.files.native, binary, "must not mutate native source");
    rejects({ elements: [], files: { native: encodedFile(mime, bytes.subarray(0, 12)) } }, "invalid_file");
    rejects({ elements: [], files: { native: encodedFile(mime, Buffer.from("not an image")) } }, "invalid_file");
  }
  const avif = fixtures.find(([mime]) => mime === "image/avif")[1];
  const ispe = avif.indexOf(Buffer.from("ispe"));
  for (const mutate of [
    (bytes) => bytes.writeUInt32BE(9000, ispe + 8),
    (bytes) => bytes.writeUInt32BE(0x7fffffff, 0),
    (bytes) => bytes.write("jpeg", 8),
    (bytes) => bytes.write("free", bytes.indexOf(Buffer.from("mdat"))),
    (bytes) => bytes.writeUInt32BE(0, bytes.indexOf(Buffer.from("iloc")) + 18),
  ]) {
    const broken = Buffer.from(avif); mutate(broken);
    // Replacing only the major brand remains AVIF if a compatible brand exists.
    if (broken.toString("ascii", 8, 12) === "jpeg") {
      assert.doesNotThrow(() => parseWhiteboardScene({ elements: [], files: { native: encodedFile("image/avif", broken) } }));
    } else rejects({ elements: [], files: { native: encodedFile("image/avif", broken) } }, "invalid_file");
  }
  for (const [mime, bytes, mutate] of [
    ["image/gif", fixtures[0][1], (value) => value.writeUInt16LE(9000, 6)],
    ["image/gif", fixtures[0][1], (value) => { value[value.length - 1] = 0; }],
    ["image/bmp", bmpFixture(), (value) => value.writeInt32LE(9000, 18)],
    ["image/bmp", bmpFixture(), (value) => value.writeUInt32LE(999999, 10)],
    ["image/bmp", bmpFixture(), (value) => value.writeUInt16LE(7, 28)],
    ["image/x-icon", fixtures[2][1], (value) => { value[6] = 20; }],
    ["image/x-icon", fixtures[2][1], (value) => value.writeUInt32LE(1, 18)],
    ["image/x-icon", fixtures[2][1], (value) => value.writeUInt32LE(999999, 14)],
  ]) {
    const broken = Buffer.from(bytes); mutate(broken);
    rejects({ elements: [], files: { native: encodedFile(mime, broken) } }, "invalid_file");
  }
});

test("animated GIF and WebP stay supported within bounded frame and total pixel budgets", async () => {
  const raw = Buffer.alloc(2 * 6 * 3, 100);
  raw.fill(240, 2 * 3 * 3);
  for (const format of ["gif", "webp"]) {
    const animated = await sharp(raw, { raw: { width: 2, height: 6, channels: 3, pageHeight: 3 } }).toFormat(format, { delay: [100, 100], loop: 0 }).toBuffer();
    const metadata = await sharp(animated, { animated: true }).metadata();
    assert.equal(metadata.pages, 2);
    const binary = encodedFile(`image/${format}`, animated);
    assert.deepEqual(parseWhiteboardScene({ elements: [], files: { native: binary } }).files.native, binary);
  }
  const tooMany = Buffer.alloc(257 * 3);
  for (let index = 0; index < 257; index++) tooMany.fill(index % 2 ? 240 : 100, index * 3, index * 3 + 3);
  const oversized = await sharp(tooMany, { raw: { width: 1, height: 257, channels: 3, pageHeight: 1 } }).gif({ delay: 100 }).toBuffer();
  assert.equal((await sharp(oversized, { animated: true }).metadata()).pages, 257);
  rejects({ elements: [], files: { native: encodedFile("image/gif", oversized) } }, "invalid_file");
});

test("native canvas-encoder PNG fallbacks migrate only MIME headers, never image bytes", () => {
  const runtime = readFileSync(new URL("../node_modules/@excalidraw/excalidraw/dist/dev/chunk-4FTI6OG3.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../node_modules/@excalidraw/excalidraw/dist/dev/index.js", import.meta.url), "utf8");
  const reducer = readFileSync(new URL("../node_modules/image-blob-reduce/index.js", import.meta.url), "utf8");
  assert.match(runtime, /type: opts\.outputType \|\| file2\.type/);
  assert.match(reducer, /this\.pica\.toBlob\(env\.out_canvas, env\.blob\.type\)/);
  const ingress = app.slice(app.indexOf('__publicField(this, "initializeImage",'), app.indexOf('__publicField(this, "insertImageElement",'));
  assert.match(ingress, /const mimeType = imageFile\.type/);
  assert.match(ingress, /imageFile = await resizeImageFile/);
  assert.match(ingress, /mimeType,\s+id: fileId,\s+dataURL/);
  for (const mime of ["image/gif", "image/bmp", "image/x-icon", "image/avif", "image/jfif", "application/octet-stream"]) {
    const native = file("native", png.replace("image/png", mime), mime);
    const result = parseWhiteboardScene({ elements: [], files: { native } }).files.native;
    assert.equal(result.mimeType, "image/png");
    assert.equal(result.dataURL, png);
    assert.equal(result.id, native.id);
    assert.equal(result.created, native.created);
    assert.equal(native.mimeType, mime, "source stays unchanged for recovery");
  }
  rejects({ elements: [], files: { native: file("native", png.replace("image/png", "image/jpeg"), "image/jpeg") } }, "invalid_file");
  rejects({ elements: [], files: { native: encodedFile("application/octet-stream", Buffer.from("arbitrary binary")) } }, "invalid_file");
  const svgBinary = encodedFile("application/octet-stream", Buffer.from(simpleSvg));
  assert.equal(parseWhiteboardScene({ elements: [], files: { native: svgBinary } }).files.native.mimeType, "image/svg+xml");
});

test("safe SVG metadata and local gradients work, without rewriting bytes", () => {
  const svg = '<?xml version="1.0" encoding="utf-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>A &amp; B &#x1f680;</title><defs><linearGradient id="a"><stop offset="0" stop-color="#fff"/></linearGradient></defs><path fill="url(#a)" style="stroke:#123;stroke-width:1" d="M0 0h24v24z"/></svg>';
  const input = svgScene(svg);
  assert.equal(parseWhiteboardScene(input).files.svg.dataURL, input.files.svg.dataURL);
});

test("all bundled SVG icons, including inline PNGs, satisfy the static scene contract", () => {
  const root = new URL("../public/", import.meta.url);
  let count = 0;
  for (const name of readdirSync(root, { recursive: true })) {
    if (!name.endsWith(".svg")) continue;
    const svg = readFileSync(new URL(name.replaceAll("\\", "/"), root), "utf8");
    assert.doesNotThrow(() => parseWhiteboardScene(svgScene(svg)), name);
    count++;
  }
  assert.ok(count >= 1_400, `Expected the real bundled cloud icon corpus, found ${count}`);
});

test("SVG rejects active markup, ambiguous XML and external resources, including encoded attempts", () => {
  const wrap = (content, attributes = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${attributes}>${content}</svg>`;
  for (const svg of [
    wrap("<script>alert(1)</script>"), wrap("<foreignObject><div/></foreignObject>"),
    wrap('<path onload="alert(1)"/>'), wrap('<image href="https://example.test/x.png"/>'),
    wrap('<image href="&#104;ttps://example.test/x.png"/>'), wrap('<image href="data:image/svg+xml;base64,PHN2Zy8+"/>'),
    wrap('<path fill="url(https://example.test/x.svg#a)"/>'),
    wrap('<path style="fill:u\\72l(https://example.test)"/>'),
    wrap('<path style="fill:URL(https://example.test)"/>'),
    wrap('<path style="background-image:url(https://example.test)"/>'),
    wrap('<style>@import "https://example.test";</style>'),
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "https://example.test">]>' + simpleSvg,
    '<?xml-stylesheet href="https://example.test"?>' + simpleSvg,
    wrap('<svg xmlns="http://www.w3.org/1999/xhtml"><script/></svg>'),
    wrap('<path id="x" id="y"/>'), wrap('<path fill="#fff"></g>'), simpleSvg + simpleSvg,
    wrap('<animate attributeName="href" to="https://example.test"/>'), wrap('<use href="#a"/>'),
    wrap('<path fill="&unknown;"/>'), wrap('<path/>', 'onload="x"'),
    '<svg width="Infinity" height="1"/>', "<svg/>", '<svg viewBox="0 0 0 24"/>',
    wrap("\u0000"), wrap("bad]]>text"),
  ]) rejects(svgScene(svg), "unsafe_svg");
});

test("bounded input rejects cycles, accessors, sparse arrays, non-JSON data and runaway totals", () => {
  const cyclic = scene(); cyclic.loop = cyclic; rejects(cyclic);
  const getter = { elements: [] }; Object.defineProperty(getter, "secret", { enumerable: true, get() { throw new Error("must not execute"); } }); rejects(getter);
  const sparse = []; sparse.length = 2; rejects({ elements: sparse });
  const disguisedSparse = []; disguisedSparse.length = 1; disguisedSparse.metadata = "not an element"; rejects({ elements: disguisedSparse });
  rejects({ elements: [], appState: new Map() });
  rejects(JSON.parse('{"elements":[],"__proto__":{"polluted":true}}'));
  rejects(scene(shape("x", "rectangle", { customData: { value: undefined } })));
  let metadata = {}; for (let i = 0; i <= limits.depth; i++) metadata = { nested: metadata };
  rejects({ elements: [], metadata }, "limit_exceeded");
  rejects({ elements: Array.from({ length: limits.elements + 1 }, (_, index) => shape(`r${index}`)) }, "limit_exceeded");
  rejects(scene(shape("f", "freedraw", { points: Array.from({ length: limits.pointsPerElement + 1 }, () => [0, 0]) })));
  const tooManyPoints = Array.from({ length: 6 }, (_, index) => shape(`f${index}`, "freedraw", { points: Array.from({ length: limits.pointsPerElement }, () => [0, 0]) }));
  rejects(scene(...tooManyPoints), "limit_exceeded");
  rejects({ elements: [], files: Object.fromEntries(Array.from({ length: limits.files + 1 }, (_, i) => [`f${i}`, file(`f${i}`)])) }, "limit_exceeded");
});
