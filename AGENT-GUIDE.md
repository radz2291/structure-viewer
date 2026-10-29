# Author a shared explanation

Work only on maps in this viewer unless the owner separately authorizes repository changes. The viewer never runs map content and needs no language parser or AI backend. Read the repository yourself, then translate your evidence into a bounded explanation.

## A useful map

- Start with 5–10 meaningful nodes in an overview; show the boundaries and responsibilities the owner needs to understand.
- Add a viewpoint for one complete behavior: entry, state/data changes, result, failure or unknown.
- Add a discussion/proposal viewpoint when needed. Clearly separate observed source facts, inference and proposed changes. Do not present a proposed change as already implemented.
- Use stable IDs across viewpoints and revisions. A node can be a module, function, data object, concept or decision. The `kind` label is free text.
- Describe each role in plain language. Cite source file, symbol and line where available. Pin repository revision, inspection time, method and limitations. A source fact in one worktree does not prove installed runtime behavior.
- Relationships must explain why the endpoints connect. Their direction should read as a sentence: source → label → target. Keep authored node positions clear in each view. Sparse views make this more useful than a full repository dump.
- Read `document.notes` before updating. An owner note retains its original `atRevision` and optional stable node ID. Do not silently remove it. No background messaging occurs.

## CLI

Run from this directory while the server is running. Default address: `http://127.0.0.1:4377`. Set `VIEWER_URL` for another port. The CLI obtains a current local session token itself. Every mutation requires the current base revision, author and meaningful summary. A conflict is HTTP 409: reread, reconcile, then retry with a new base. Never blindly overwrite.

```powershell
node cli.mjs list
node cli.mjs get vict-designer
node cli.mjs get vict-designer 1
node cli.mjs history vict-designer
node cli.mjs validate .\my-map.json
node cli.mjs put my-map .\my-map.json --base 0 --author Codex --summary "Explain checkout entry and data flow"
node cli.mjs patch my-map .\operations.json --base 1 --author Codex --summary "Clarify persistence boundary"
node cli.mjs delete my-map unused --base 2 --author Codex --summary "Archive superseded explanation"
```

`delete` archives the map; history remains readable. To restore it, retrieve any prior revision's `document`, then `put` it with the current archived revision as `--base`. Never manually edit `data/maps` to update maps. The browser and CLI use the same store. Export JSON gives just the document; `get` returns an envelope including `document`, `revision`, author, summary and time. Do not pass the whole envelope to `put`.

## Document contract (version 1)

See `examples/viewer-guide.json` for a complete starter. The executable schema is `lib/store.mjs` (`documentSchema`); unsupported fields are rejected.

```json
{
  "schemaVersion": 1,
  "id": "my-map",
  "project": "My project",
  "title": "Understanding checkout",
  "description": "What this explanation covers and why it matters.",
  "provenance": {
    "repository": "C:/path/to/repository",
    "revision": "exact commit plus worktree status if relevant",
    "inspectedAt": "2026-10-29T16:00:00.000Z",
    "method": "Read-only source inspection",
    "limitations": "What is unknown or deliberately omitted"
  },
  "nodes": [{
    "id": "entry", "title": "Checkout request", "kind": "boundary",
    "summary": "One sentence visible on the card.",
    "body": "Plain-language explanation, with enough detail to discuss implementation.",
    "evidence": "observed",
    "sources": [{"file": "src/checkout.ts", "symbol": "checkout", "line": 12}]
  }],
  "edges": [],
  "views": [{
    "id": "overview", "title": "Overview", "description": "The question this viewpoint answers.",
    "nodes": ["entry"], "positions": {"entry": {"x": 0, "y": 0}}
  }],
  "notes": []
}
```

Edge: `{ "id":"entry-store", "source":"entry", "target":"store", "label":"writes to", "body":"Why this relationship exists and evidence limits.", "evidence":"observed" }`. Both endpoints must exist. `evidence` is exactly `observed`, `inference` or `proposal`. Each view lists existing nodes, with optional positions (fallback positions are a simple grid). A node may be shared by many views. Edges are shown when both endpoints belong to the active view. IDs use letters, digits, dots, dashes or underscores (1–80 characters, beginning with a letter or digit). Nonempty documents and viewpoints are required. Sources are citations only; no path is opened or executed.

An edge may also declare `role`: `hierarchy`, `read`, `write`, `action`, `definition`, `navigation` or `reference`. Author this from inspected meaning; it is never inferred from the label. Unspecified roles use neutral `reference`. Role controls sockets/line style, while evidence remains a separate observed/inference/proposal assertion. Nodes remain taxonomy-free. Connection points group visible records by label and role; identical endpoint/meaning records share one painted line and keep all stable record IDs. All routing preserves incoming-left/outgoing-right points. Arrangement is view-local until you deliberately publish positions through `put`.

## CRUD operations

A patch file is an array of operations, applied atomically as one revision:

```json
[
  {"op":"upsertNode", "value":{"id":"cache", "title":"Cache", "kind":"data", "summary":"Stores reusable results.", "body":"Why it exists and how it is used.", "evidence":"inference", "sources":[]}},
  {"op":"upsertEdge", "value":{"id":"entry-cache", "source":"entry", "target":"cache", "label":"reads", "body":"Explain the read.", "evidence":"inference"}}
]
```

Other operations: `{ "op":"deleteNode", "id":"cache" }`, `{ "op":"deleteEdge", "id":"entry-cache" }`, `{ "op":"addNote", "nodeId":"entry", "text":"Question" }` (`nodeId` optional). Node deletion also removes incident edges and view membership/positions. Notes keep historical target IDs. Deleting the last node of a view fails validation; update the complete document through `put` if the viewpoint itself must be removed. Use `put` to change view membership/positions, descriptions or provenance. Creating a node does not automatically place it in a view.

HTTP equivalents: GET `/api/maps`, GET `/api/maps/ID[?revision=N]`, GET `/api/maps/ID/history`; PUT/PATCH/DELETE `/api/maps/ID`. Write bodies have `expectedRevision`, `author`, `summary` and either `document` (PUT), `operations` (PATCH), or no payload (DELETE). All writes need `Content-Type: application/json` and `Authorization: Bearer TOKEN`; GET `/api/bootstrap` obtains a token from a same-origin local session. Body limit is 2 MB. This API is deliberately loopback-only.

## Recovery and versioning

Revisions are complete snapshots, never deltas. Save flushes a new file and publishes it without replacing an existing revision; stale concurrent writes fail. A server restart reopens the same history. Archive adds a tombstone; it does not erase files. To recover from an accidental map change, read the desired historic document and submit it as a new revision with an explicit recovery summary. Preserve later owner notes during reconciliation.

Back up the complete `data/` folder before filesystem maintenance. A `.tmp` file left by interrupted publication is ignored; it is not a committed revision. This app does not offer disk-failure recovery or collaboration across untrusted users. It never writes to the mapped source repository.
