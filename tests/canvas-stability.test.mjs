import { test } from "node:test";
import assert from "node:assert/strict";
import { adoptUserNodes, nodeHasDimensions } from "@xyflow/system";
import {
  geometryKey,
  retainMeasurement,
  applyMeasurements,
  applyPositions,
  stablePreview,
  connectionGroups,
  connectionGeometry,
  feedbackRoute,
  restoreInspection,
} from "../lib/canvas-model.mjs";
import { connectionPorts, portId } from "../lib/view-model.mjs";
const source = {
  id: "a",
  title: "Reader",
  kind: "function",
  summary: "Read the record.",
};
const edges = [
  {
    id: "ab",
    source: "a",
    target: "b",
    label: "reads",
    role: "read",
    evidence: "observed",
    body: "Input one.",
  },
];
const ports = connectionPorts(edges, "a"),
  key = geometryKey(source, ports);
const base = {
  id: "a",
  type: "source",
  position: { x: 0, y: 0 },
  data: { ...source, ports, geometryKey: key },
};
test("reproduces the old measurement loss in the actual graph engine; hover and selection retain initialized cards and socket bounds", () => {
  let geometry = applyMeasurements(
    {},
    [{ id: "a", type: "dimensions", dimensions: { width: 224, height: 154 } }],
    [base],
  );
  const lookup = new Map(),
    parents = new Map();
  const node = retainMeasurement(base, geometry);
  adoptUserNodes([node], lookup, parents);
  const handles = {
    source: [
      { id: portId("out", edges[0]), x: 220, y: 130, width: 7, height: 7 },
    ],
    target: [],
  };
  lookup.get("a").internals.handleBounds = handles;
  // This is the former presentation rebuild: the library hides the unmeasured
  // node and clears its sockets even though it was just initialized.
  adoptUserNodes(
    [{ ...base, data: { ...base.data, hovered: true } }],
    lookup,
    parents,
  );
  assert.equal(nodeHasDimensions(lookup.get("a")), false);
  assert.equal(lookup.get("a").internals.handleBounds, undefined);
  adoptUserNodes([node], lookup, parents);
  lookup.get("a").internals.handleBounds = handles;
  for (let index = 0; index < 500; index++) {
    const rendered = retainMeasurement(
      {
        ...base,
        selected: index % 2 === 0,
        data: { ...base.data, traced: index % 3 === 0 },
      },
      geometry,
    );
    const result = adoptUserNodes([rendered], lookup, parents);
    assert.equal(result.nodesInitialized, true);
    assert.equal(nodeHasDimensions(lookup.get("a")), true);
    assert.strictEqual(lookup.get("a").internals.handleBounds, handles);
    assert.deepEqual(lookup.get("a").position, { x: 0, y: 0 });
  }
  assert.strictEqual(
    applyMeasurements(
      geometry,
      [
        {
          id: "a",
          type: "dimensions",
          dimensions: { width: 224, height: 154 },
        },
      ],
      [base],
    ),
    geometry,
  );
});
test("only a geometry change invalidates measurements; preview and unchanged positions are idempotent", () => {
  assert.equal(
    geometryKey({ ...source, selected: true, traced: true }, ports),
    key,
  );
  assert.notEqual(
    geometryKey({ ...source, title: "A longer title" }, ports),
    key,
  );
  assert.notEqual(
    geometryKey(source, [...ports, { ...ports[0], id: "extra" }]),
    key,
  );
  const preview = ["ab"];
  assert.strictEqual(stablePreview(preview, ["ab", "ab"]), preview);
  const empty = [];
  assert.strictEqual(stablePreview(empty, []), empty);
  const positions = { a: { x: 10, y: 20 } };
  assert.strictEqual(
    applyPositions(positions, [
      { id: "a", type: "position", position: { x: 10, y: 20 } },
    ]),
    positions,
  );
  assert.strictEqual(
    applyPositions(positions, [{ id: "a", type: "select", selected: true }]),
    positions,
  );
});
test("every layout keeps the same visible role sockets; feedback routing is independent of selection", () => {
  for (const b of [
    { x: 400, y: 0 },
    { x: -400, y: 0 },
    { x: 0, y: 300 },
    { x: 0, y: -300 },
  ]) {
    const geometry = connectionGeometry(edges[0], [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: b },
    ]);
    assert.equal(geometry.sourceHandle, portId("out", edges[0]));
    assert.equal(geometry.targetHandle, portId("in", edges[0]));
    assert.equal(Object.hasOwn(geometry, "source"), false);
  }
  const cards = [
    { x: 0, y: 0, width: 224, height: 150 },
    { x: 330, y: 0, width: 224, height: 150 },
  ];
  const path = feedbackRoute({ x: 554, y: 100 }, { x: 0, y: 100 }, cards);
  assert.equal(
    path,
    feedbackRoute({ x: 554, y: 100 }, { x: 0, y: 100 }, cards),
  );
  assert.ok(path.startsWith("M 554,100"));
  assert.ok(path.endsWith("0,100"));
});
test("painted duplicate groups retain canonical records without folding different authored roles or evidence", () => {
  const copies = [
    ...edges,
    { ...edges[0], id: "ab-two" },
    { ...edges[0], id: "ab-proposal", evidence: "proposal" },
  ];
  const groups = connectionGroups(copies);
  assert.deepEqual(groups[0].members, ["ab", "ab-two"]);
  assert.equal(groups.length, 2);
});
test("refresh/version restoration keeps valid context and never restores an empty focus or a foreign document selection", () => {
  const doc = {
    id: "map",
    nodes: [{ id: "a" }, { id: "b" }],
    edges,
    views: [{ id: "view", nodes: ["a", "b"] }],
  };
  const saved = {
    documentId: "map",
    items: [
      { type: "node", id: "a" },
      { type: "edge", id: "gone" },
    ],
    focus: ["a", "gone"],
    query: "reader",
    viewId: "view",
  };
  assert.deepEqual(restoreInspection(doc, saved), {
    items: [{ type: "node", id: "a" }],
    focus: ["a"],
    query: "reader",
    viewId: "view",
  });
  assert.equal(
    restoreInspection(doc, { ...saved, focus: ["gone"] }).focus,
    null,
  );
  assert.deepEqual(restoreInspection({ ...doc, id: "other" }, saved), {
    items: [],
    focus: null,
    query: "",
    viewId: "view",
  });
});
