import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store, validate } from "../lib/store.mjs";
const sample = JSON.parse(
  fs.readFileSync(
    new URL("../examples/viewer-guide.json", import.meta.url),
    "utf8",
  ),
);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "structure-viewer-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return new Store(root);
}
const meta = (base, summary = "test") => ({
  expectedRevision: base,
  author: "test agent",
  summary,
});
test("create, update, delete node, archive, restore and restart preserve prior revisions", (t) => {
  const s = fixture(t),
    doc = structuredClone(sample);
  s.commit(doc.id, doc, meta(0, "create"));
  const node = {
    ...doc.nodes[0],
    id: "scratch",
    title: "Temporary explanation",
  };
  s.patch(doc.id, [{ op: "upsertNode", value: node }], meta(1, "create node"));
  s.patch(
    doc.id,
    [{ op: "upsertNode", value: { ...node, body: "Revised explanation" } }],
    meta(2, "update node"),
  );
  s.patch(
    doc.id,
    [{ op: "deleteNode", id: "scratch" }],
    meta(3, "delete node"),
  );
  assert.equal(s.get(doc.id, 2).document.nodes.at(-1).body, node.body);
  assert.equal(
    s.get(doc.id, 3).document.nodes.at(-1).body,
    "Revised explanation",
  );
  assert.ok(!s.get(doc.id).document.nodes.some((n) => n.id === "scratch"));
  s.commit(doc.id, s.get(doc.id).document, meta(4, "archive"), true);
  assert.equal(s.list()[0].deleted, true);
  s.commit(doc.id, s.get(doc.id, 1).document, meta(5, "restore"));
  const restarted = new Store(s.root);
  assert.equal(restarted.get(doc.id).revision, 6);
  assert.equal(restarted.get(doc.id, 1).author, "test agent");
  assert.equal(restarted.history(doc.id).length, 6);
});
test("reject stale writers, malformed maps, paths, duplicate IDs, dangling relations and invalid views", (t) => {
  const s = fixture(t);
  s.commit(sample.id, sample, meta(0));
  assert.throws(
    () => s.commit(sample.id, sample, meta(0)),
    /Revision conflict/,
  );
  assert.throws(() => s.get("../outside"), /Invalid map ID/);
  for (const mutate of [
    (d) => d.nodes.push(d.nodes[0]),
    (d) => (d.edges[0].target = "missing"),
    (d) => d.views[0].nodes.push("missing"),
    (d) => (d.views[0].positions.owner.x = Infinity),
    (d) => (d.schemaVersion = 2),
    (d) => (d.unexpected = "ignored?"),
  ]) {
    const d = structuredClone(sample);
    mutate(d);
    assert.throws(() => validate(d));
  }
  assert.equal(s.history(sample.id).length, 1);
});
test("notes persist with attribution, context revision, stable target; bad patch is atomic", (t) => {
  const s = fixture(t);
  s.commit(sample.id, sample, meta(0));
  s.patch(
    sample.id,
    [{ op: "addNote", text: "Why this boundary?", nodeId: "boundary" }],
    { ...meta(1), author: "Radzi" },
  );
  const note = new Store(s.root).get(sample.id).document.notes[0];
  assert.equal(note.text, "Why this boundary?");
  assert.equal(note.atRevision, 1);
  assert.equal(note.author, "Radzi");
  assert.throws(() =>
    s.patch(
      sample.id,
      [{ op: "deleteNode", id: "owner" }, { op: "unknown" }],
      meta(2),
    ),
  );
  assert.ok(s.get(sample.id).document.nodes.some((n) => n.id === "owner"));
  assert.equal(s.history(sample.id).length, 2);
});
test("all shipped maps validate", () => {
  for (const name of fs.readdirSync(new URL("../examples/", import.meta.url))) {
    if (name.endsWith(".json"))
      validate(
        JSON.parse(
          fs.readFileSync(
            new URL("../examples/" + name, import.meta.url),
            "utf8",
          ),
        ),
      );
  }
});
test("relationship roles are optional authored semantics, independent of evidence and never guessed from a label", () => {
  const legacy = validate(structuredClone(sample));
  assert.equal(legacy.edges[0].role, undefined);
  const explicit = structuredClone(sample);
  explicit.edges[0].role = "write";
  explicit.edges[0].evidence = "inference";
  assert.equal(validate(explicit).edges[0].role, "write");
  explicit.edges[0].role = "guessed";
  assert.throws(() => validate(explicit));
});
