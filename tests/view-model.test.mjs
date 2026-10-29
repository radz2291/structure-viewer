import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCatalog,
  selectItems,
  selectFromEvent,
  selectionDetails,
  selectionChanges,
  selectedRoots,
  projectView,
  connectionPorts,
  portId,
  traceSelection,
  arrangeGraph,
} from "../lib/view-model.mjs";

const catalog = [
  { id: "old-only", project: "Archive only", deleted: true },
  { id: "mixed-old", project: "Mixed", deleted: true },
  { id: "mixed-new", project: "Mixed", deleted: false },
  { id: "other", project: "Other", deleted: false },
];
test("archived-only projects select an eligible map; archive visibility transitions preserve a valid selection", () => {
  assert.deepEqual(
    resolveCatalog(catalog, { project: "Archive only", showArchived: true }),
    { project: "Archive only", mapId: "old-only" },
  );
  assert.deepEqual(
    resolveCatalog(catalog, {
      project: "Archive only",
      mapId: "old-only",
      showArchived: false,
    }),
    { project: "Mixed", mapId: "mixed-new" },
  );
  assert.deepEqual(
    resolveCatalog(catalog, {
      project: "Mixed",
      mapId: "mixed-old",
      showArchived: true,
    }),
    { project: "Mixed", mapId: "mixed-old" },
  );
  assert.deepEqual(
    resolveCatalog(catalog, {
      project: "Mixed",
      mapId: "mixed-old",
      showArchived: false,
    }),
    { project: "Mixed", mapId: "mixed-new" },
  );
  assert.deepEqual(
    resolveCatalog(catalog, { project: "Mixed", showArchived: true }),
    { project: "Mixed", mapId: "mixed-new" },
  );
  assert.deepEqual(
    resolveCatalog(
      catalog.filter((map) => map.deleted),
      { showArchived: false },
    ),
    { project: "", mapId: "" },
  );
  assert.deepEqual(
    resolveCatalog(
      catalog.filter((map) => map.deleted),
      { showArchived: true },
    ),
    { project: "Archive only", mapId: "old-only" },
  );
});
const edges = [
  { id: "ab", source: "a", target: "b", label: "reads", evidence: "observed" },
  { id: "ac", source: "a", target: "c", label: "reads", evidence: "observed" },
  { id: "cd", source: "c", target: "d", label: "writes", evidence: "proposal" },
];
const nodes = ["a", "b", "c", "d", "isolated"].map((id) => ({ id }));
test("pending or failed document loads safely hide a retained group; a new document supplies fresh labels", () => {
  const group = [{ type: "node", id: "a" }, { type: "edge", id: "ab" }];
  const before = structuredClone(group);
  assert.deepEqual(selectionDetails(undefined, group), []);
  assert.deepEqual(selectionDetails(null, group), []);
  assert.deepEqual(selectionDetails({ nodes: [], edges: [] }, group), []);
  assert.deepEqual(
    selectionDetails({ nodes: [{ id: "a", title: "New source" }], edges }, group),
    [{ type: "node", id: "a", label: "New source" },
      { type: "edge", id: "ab", label: "reads" }],
  );
  assert.deepEqual(group, before);
});
test("relationship-row clicks replace normally and add or remove with Ctrl, Meta or Shift", () => {
  const node = { type: "node", id: "a" }, edge = { type: "edge", id: "ab" };
  assert.deepEqual(selectFromEvent([node], [edge]), [edge]);
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey"]) {
    const event = { [modifier]: true };
    const group = selectFromEvent([node], [edge], event);
    assert.deepEqual(group, [node, edge]);
    assert.deepEqual(selectFromEvent(group, [edge], event), [node]);
  }
});
test("ports group relationship labels and semantic roles independently of evidence", () => {
  const ports = connectionPorts(edges, "a");
  assert.equal(ports.length, 1);
  assert.deepEqual(ports[0].edges, ["ab", "ac"]);
  assert.equal(ports[0].side, "out");
  assert.equal(connectionPorts(edges, "b")[0].side, "in");
  assert.equal(
    connectionPorts(
      [...edges, { ...edges[1], id: "another", evidence: "inference" }],
      "a",
    ).length,
    1,
  );
  assert.equal(connectionPorts([...edges,{...edges[1],id:'semantic',role:'read'}],'a').length,2);
  const unsafe = { label: 'quote"[x]\\', evidence: "observed" };
  assert.ok(!portId("out", unsafe).includes('"'));
  assert.notEqual(portId("in", unsafe), portId("out", unsafe));
});
test("group selection and partial port selection preserve explicitly selected objects only", () => {
  const one = [{ type: "node", id: "a" }],
    port = [
      { type: "edge", id: "ab" },
      { type: "edge", id: "ac" },
    ];
  const group = selectItems(one, port, true);
  assert.equal(group.length, 3);
  assert.deepEqual(selectItems(group, port, true), one);
  const partial = selectItems([], port.slice(0, 1));
  assert.deepEqual(selectItems(partial, port, true), port);
  const changes = selectionChanges(
    one,
    [{ type: "select", id: "b", selected: true }],
    "node",
  );
  assert.deepEqual(changes, [...one, { type: "node", id: "b" }]);
  assert.deepEqual(
    selectionChanges(
      changes,
      [{ type: "select", id: "a", selected: false }],
      "node",
    ),
    [{ type: "node", id: "b" }],
  );
  assert.strictEqual(
    selectionChanges(one, [{ type: "dimensions", id: "a" }], "node"),
    one,
  );
  assert.deepEqual(selectedRoots(port, edges), ["a", "b", "c"]);
});
test("group focus unions direct neighborhoods within the authored view; hover tracing never changes selection", () => {
  const doc = { nodes, edges },
    view = { nodes: ["a", "b", "c", "d", "isolated"] },
    chosen = [
      { type: "node", id: "b" },
      { type: "node", id: "d" },
    ];
  const focused = projectView(doc, view, selectedRoots(chosen, edges));
  assert.deepEqual(
    focused.nodes.map((n) => n.id),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual(
    projectView(doc, { nodes: ["a", "b"] }, ["b"]).nodes.map((n) => n.id),
    ["a", "b"],
  );
  const trace = traceSelection(edges, chosen, [{ type: "edge", id: "ac" }]);
  assert.deepEqual([...trace.edges].sort(), ["ab", "ac", "cd"]);
  assert.equal(chosen.length, 2);
  assert.ok(!chosen.some((item) => item.id === "a"));
  assert.equal(traceSelection(edges, [], []).active, false);
});
test("arrangement handles branching, cycles, disconnected nodes and measured heights without mutating authored positions", () => {
  const authored = nodes.map((n, i) => ({
      ...n,
      position: { x: i, y: i },
      measured: { width: 242, height: n.id === "a" ? 290 : 180 },
    })),
    before = structuredClone(authored);
  const arranged = arrangeGraph(authored, [
    ...edges,
    { id: "loop", source: "c", target: "a" },
  ]);
  assert.deepEqual(authored, before);
  assert.equal(Object.keys(arranged).length, nodes.length);
  const rects = authored.map((n) => ({
    ...arranged[n.id],
    width: n.measured.width,
    height: n.measured.height,
  }));
  for (const r of rects)
    assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y));
  for (let a = 0; a < rects.length; a++)
    for (let b = a + 1; b < rects.length; b++) {
      const x = rects[a],
        y = rects[b];
      assert.ok(
        x.x + x.width <= y.x ||
          y.x + y.width <= x.x ||
          x.y + x.height <= y.y ||
          y.y + y.height <= x.y,
        "cards must not overlap",
      );
    }
  assert.deepEqual(arrangeGraph([], []), {});
  assert.throws(() => arrangeGraph(nodes, edges, "bad"));
});
