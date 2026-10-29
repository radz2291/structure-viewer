# Structure Viewer

A small local communication surface for Radzi and a coding agent. The agent reads a repository and authors a map; the owner explores the same explanation, asks questions, and returns to earlier saved revisions.

## Open it

Double-click `Start-Viewer.cmd`, then open **http://127.0.0.1:4377** in the built-in browser. Keep the launcher window open. Stop with Ctrl+C. If port 4377 belongs to another application, leave that application alone and set `$env:PORT=4378; npm start` in PowerShell; set `VIEWER_URL` to the matching address for CLI use.

From PowerShell:

```powershell
cd path\to\structure-viewer
npm ci --no-audit --no-fund
npm run build
npm start
```

Node 22 is required. A fresh clone needs `npm ci --no-audit --no-fund` and `npm run build` before using the launcher or `npm start`; generated dependencies and `dist` are not committed. To verify source changes, run `npm test`. No API key, account, cloud service or VICT installation is needed. `npm run dev` is frontend development only; use the production build and `npm start` for the full app.

## Try it

1. Choose **VICT · ara-proof example** → **One deterministic ARA turn**. The older Designer source study remains available as another project.
2. Start with **What the example contains**, then **Follow one message**. Select a node or connection point to inspect its meaning.
3. The stable **Selection** panel has Overview, Relations, Evidence and Questions pages. **Document** holds the map's source revision, scope and export. Choosing an object updates the selection without opening unrelated tools.
4. Select a card or its labeled incoming/outgoing relationship rows to inspect connections. Hover or focus a relationship row to preview its trace. Ctrl/Shift-click adds or removes items from a group (Command-click also works).
5. Use **Connections** to explore selected items' direct neighborhoods. **All in view** restores the full viewpoint. The **View** menu owns Fit all, Fit selection, Arrange down/right and Restore authored positions. These commands change presentation only. Search finds across the full map; selection alone does not move the camera.
6. Write a question under **Selection → Questions**. Save it as a new revision. The agent can read it with the CLI.
7. Choose an earlier saved revision to revisit the prior explanation. **Refresh from agent** loads new changes. Export JSON produces a portable map document. Enable **Include archived maps** to revisit archived explanations and their history.

Nodes and edges have stable IDs. A relationship's optional authored role controls its line/socket color and dash (read, write, action, hierarchy, definition, navigation or generic reference). Evidence is separate: observed, inference or proposal appears as an inspection badge. Unspecified roles remain generic references; the viewer never guesses a role from wording. Evidence status is the author's claim, not an automated verification stamp.

## Local data

The first launch seeds `data/maps/` from `examples/`. Each map revision is a complete, immutable JSON snapshot: `data/maps/MAP-ID/00000001.json`. Updates append; archival is a tombstone revision. Copy the whole `data` folder for backup. Seed examples never replace an existing map, including an archived one. Layout dragging is temporary and does not edit authored positions. The agent can publish durable positions through a document revision.

Questions are durable map annotations. They do not automatically message or wake an agent. Old revisions remain read-only in the UI. A stale save returns a conflict; copy your unsaved question, refresh and retry. Project membership comes from the document's `project` field.

Unsaved question drafts stay in this browser's local storage, separately for each map, revision and node. Navigate back to the same context to resume one. Clearing browser storage removes drafts; saved questions remain in the local data files. A conflict keeps the draft attached to the original revision so you can copy it before reconciling.

## Scope and limits

This is an authored explanation viewer, not a parser, IDE, runtime debugger or approval system. It reads no mapped source files at runtime. Source references are text citations; there is no source editing or execution. Code, HTML and links inside maps render as text. There is no automatic repository freshness check. The example records the inspected revision and source hashes, but may differ from an installed VICT. Viewpoints are explicitly authored subsets, not exhaustive dependency trees.

Designed for a local trusted workstation and modest explanations (up to 500 nodes per document, 1,500 edges and 30 viewpoints). Network binding is loopback only. Host, origin, fetch-site and session-token checks protect local writes from foreign websites. Local processes and people with access to this workstation can access the viewer; it is not a multi-user security boundary. Saves flush a temporary file then atomically publish a new revision without overwriting. Backups remain advisable for disk or filesystem failure. Do not run multiple servers against the same data folder; concurrent revision collisions fail safely.

## Design reference

Read-only reference: `vict-authoring-foundation`, branch `codex/authoring-foundation`, HEAD `4c40cc656328c50d16d28492ae5245bf509ccb6e`. The map's `evidence/source-manifest.json` pins inspected source file hashes. Its source was not changed, launched or installed.

The VICT Structure tab informed the quiet cards, blue selection, fixed incoming-left/outgoing-right role rows, edge/point tracing, typed group selection and focused inspection sections. Rows group relationships by authored label and semantic role, independently of evidence. All edges stay connected to their visible sockets even in reversed or vertical layouts. Equivalent declaration records share a painted path but retain exact record IDs and partial selection. Highlighted neighbors never join the explicit selection.

The owner-supplied UI preferences informed the compact chrome, predictable Selection/Document panel, one open inspection page, consistent identities and single View menu. Hover and selection are presentation-only; they cannot remove measurements, change card positions or refit the camera. Valid inspection context and browser drafts survive refresh and revision changes. Dagre provides temporary arrangement; authored positions remain recoverable.

Intentional differences: this viewer uses React Flow and agent-authored repository explanations rather than VICT's UI runtime, declarations, editing commands or occurrence hierarchy. Selection's Evidence page is the local equivalent of technical inspection. Document is specific to explanation provenance and revisions. Dagre replaces ELK; routing is simpler for densely overlapping diagrams. This is practical reference fidelity, not an assertion of exact VICT parity. No VICT runtime code was imported. The reference Apache-2.0 license was inspected; React Flow and Dagre are MIT licensed. See `evidence/PARITY-AND-STABILITY.md` for the comparison and verification.

See `AGENT-GUIDE.md` for the authoring contract, CLI and recovery. `evidence/` records focused validation results. Git excludes local map histories, annotations, generated assets, logs and local authoring receipts. Only empty-note seed examples and selected verification records are published.
