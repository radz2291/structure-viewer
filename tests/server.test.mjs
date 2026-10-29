import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server.mjs";
const doc = JSON.parse(
  fs.readFileSync(
    new URL("../examples/viewer-guide.json", import.meta.url),
    "utf8",
  ),
);
test("real HTTP boundary: CRUD, optimistic concurrency, security, invalid input, restart", async (t) => {
  const dataRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "structure-viewer-http-"),
  );
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));
  let app = createServer({ port: 0, dataRoot, seed: false });
  await app.listen();
  t.after(() => app.server.close());
  let base = `http://127.0.0.1:${app.server.address().port}`;
  const boot = await (await fetch(base + "/api/bootstrap")).json();
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + boot.token,
  };
  const body = {
    document: doc,
    expectedRevision: 0,
    author: "HTTP agent",
    summary: "Created over API",
  };
  let r = await fetch(base + "/api/maps/" + doc.id, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 200);
  r = await fetch(base + "/api/maps/" + doc.id, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 409);
  r = await fetch(base + "/api/maps/" + doc.id, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      expectedRevision: 1,
      author: "HTTP agent",
      summary: "Note",
      operations: [{ op: "addNote", text: "Shared question" }],
    }),
  });
  assert.equal(r.status, 200);
  r = await fetch(base + "/api/maps/" + doc.id, {
    method: "DELETE",
    headers,
    body: JSON.stringify({
      expectedRevision: 2,
      author: "HTTP agent",
      summary: "Archive",
    }),
  });
  assert.equal(r.status, 200);
  r = await fetch(base + "/api/maps/" + doc.id + "?revision=1");
  assert.equal((await r.json()).document.notes.length, 0);
  r = await fetch(base + "/api/bootstrap", {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(r.status, 403);
  r = await fetch(base + "/api/bootstrap", {
    headers: { "Sec-Fetch-Site": "cross-site" },
  });
  assert.equal(r.status, 403);
  r = await fetch(base + "/api/maps/" + doc.id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 403);
  r = await fetch(base + "/api/maps/" + doc.id, {
    method: "PUT",
    headers,
    body: "{",
  });
  assert.equal(r.status, 400);
  r = await fetch(base + "/api/maps/" + doc.id, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      ...body,
      expectedRevision: 3,
      document: { ...doc, nodes: [] },
    }),
  });
  assert.equal(r.status, 400);
  await new Promise((resolve) => app.server.close(resolve));
  app = createServer({ port: 0, dataRoot, seed: false });
  await app.listen();
  base = `http://127.0.0.1:${app.server.address().port}`;
  r = await fetch(base + "/api/maps/" + doc.id);
  const saved = await r.json();
  assert.equal(saved.revision, 3);
  assert.equal(saved.deleted, true);
  assert.equal(saved.document.notes[0].text, "Shared question");
});
