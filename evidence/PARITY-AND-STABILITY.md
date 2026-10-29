# Structure reference iteration

This iteration followed the owner's `UI design preferences.txt` and inspected the paused VICT authoring-foundation source read-only at `4c40cc656328c50d16d28492ae5245bf509ccb6e`. No VICT or ARA source/runtime was changed. This is an implementation and verification record, not an independent acceptance verdict.

Publication note: this repository includes sanitized seed documents, source manifests and selected test/build records. Screenshots, browser observation dumps, CLI receipts, local map histories and earlier review checkpoints mentioned below remain local verification artifacts and are excluded from Git. No owner annotations or preferences file is published.

## Flashing: established cause and correction

The previous controlled-node projection rebuilt every node for hover/selection without carrying React Flow's measured dimensions. The installed `@xyflow/system` `adoptUserNodes` deliberately clears a replacement node's measurements and handle bounds when `measured` is absent. The React wrapper then sets its visibility to hidden until measurement. Hiding a hovered node changes the hit target and triggers leave/enter updates, feeding another unmeasured projection. The old opacity transition made those visibility changes more noticeable; it was not the underlying cause.

The regression test reproduces measurement loss against the actual graph engine, then checks 500 selection/trace projections that retain dimensions and exact socket bounds. Measurement updates are now owned and cached by a content/port geometry signature. Selection and trace state cannot invalidate that signature. Repeated measurements, positions and previews are idempotent; pointer and keyboard focus previews have separate owners. The bounded `useUpdateNodeInternals` geometry effect was inspected and is not blamed for the defect.

The graph now has one explicit typed selection owner rather than competing native and authored selection updates. Hover/selection change presentation only. They do not choose alternative sockets, change world positions, arrange nodes or move the camera. A separate view-transition timing defect was also fixed: camera restoration/fitting waits until the new graph is adopted, and a movement started in one viewpoint cannot overwrite another viewpoint's saved camera.

## Practical parity checklist

| Area | Current viewer | Deliberate difference / limit |
| --- | --- | --- |
| Card identity | Compact primary name, supporting kind, quiet card and blue explicit-selection border; same identity pattern in navigation/inspection | Arbitrary repository concepts rather than VICT UI occurrences; no source editing |
| Connection points | Visible incoming-left/outgoing-right labeled rows; count, selected and partial state; click/keyboard activation selects exact canonical records | Authored label plus optional semantic role rather than VICT's complete declaration taxonomy |
| Edge geometry | Every layout uses those visible sockets; backward paths route outside cards; equivalent records share a painted path and retain IDs | Simpler routing than VICT/ELK for dense overlapping graphs |
| Relationship meaning | Authored hierarchy/read/write/action/definition/navigation/reference determines color/dash; unspecified roles stay generic | No semantic guessing from label text; evidence is a separate badge |
| Hover and focus | Edge/point previews trace direct connections and endpoints; keyboard focus and pointer hover do not overwrite each other | Whole-card hover stays a quiet border, matching the reference's observation emphasis |
| Selection | Node, edge group and point selection; Ctrl/Cmd/Shift additive toggles; Enter/Space and Escape; related endpoints remain context only | No runtime edit/move-ownership commands or box-selection workflow |
| Selection panel | One Overview/Relations/Evidence/Questions page at a time; subject → relationship → endpoint stories; selected versus related; group removal and exact record inspection | Evidence is the repository-viewer counterpart of Technical; Questions is a viewer-specific communication feature |
| Navigation | Explicit Connections scope, fit commands, temporary arrangement and authored-position restoration; valid selection/drafts survive refresh/revisions/view changes | Dagre replaces ELK; first visit fits the viewpoint, later visits restore its camera |
| Document | Stable separate tab owns source revision, provenance, limits and export; versions remain in a dedicated footer | Intentionally different from VICT document authoring |
| Chrome | Compact header, restrained typography, one View command surface, no permanent instruction/status stack | Standalone React/CSS implementation; no VICT runtime imported |

Reference files inspected include `StructuredSourceNode.svelte`, `StructureView.svelte`, `StructureEdge.svelte`, `StructureInspection.svelte`, `structure-connections.ts`, `structure-trace.ts`, `SelectionPanel.svelte`, `WorkspaceSelectionDetails.svelte` and `selection-relationships.ts`. Earlier pinned source hashes were checked again unchanged.

## Verification

- Complete viewer test suite and production build: see `tests-full-iteration.txt` and `build-stability-iteration.txt`. The only build warning is the existing ignored React Flow `use client` directive.
- Engine regression: reproduces the old measurement loss and verifies 500 geometry-preserving interaction projections. Also covers idempotent previews/measurements, fixed visible sockets in every orientation, grouped records and context restoration.
- Supported in-app browser only, no raw CDP or alternative browser: pointer card/edge/point activation, partial `mixed` point state, grouped duplicate paths, Ctrl mixed selection, removing a group member, keyboard point activation, six repeated select/deselect/preview cycles and stationary visibility/position samples.
- Final real-example selected and mixed views each stayed visible and geometrically unchanged across 20 DOM observations. `browser-stability-iteration.json` retains observations. Browser error/warning inspection returned no entries.
- Verified archive-only project loading and visibility fallback; source evidence; project/viewpoint changes including selection outside the view; question draft retention across projects; a saved test question creating revision 2; historical read-only revision 1; restoration to latest; refresh preserving selection and camera; temporary arrange changing positions and Restore authored positions recovering them exactly.
- The clearly labeled interaction fixture was archived at revision 3, retaining its test history. Prior VICT map revision 3 and viewer-guide revision 4 still match their earlier saved envelopes exactly. Product maps were not overwritten.
- The prior raw-CDP permission request was not retried or treated as granted. Ordinary supported browser controls were sufficient for this iteration's checks.

## Real example: ara-proof

The requested GitHub `main` resolved to `d7401bef6e48330796c74ec00c86db9622d48cdf`. Eight files were fetched at that exact commit, recorded in `ara-proof-source-manifest.json`. The new `ara-proof` map was created through the CLI as revision 1 and is also shipped in `examples/ara-proof.json` for first launch.

It includes an overview, one end-to-end message path and an evidence/open-questions view. It distinguishes the deterministic `read`-classified assistant from a live model request, explains final validation/trace printing, and identifies the fresh-runtime-per-wrapper-call question. The test file builds a related `ara2` graph; its assertions are not presented as execution evidence. No target demo or tests ran. This example is not the deployed ARA Light app/backend and is not labeled as an acceptance proof.

Screenshots: `iteration-ara-flow.png` and `iteration-selection.png`. The old baseline screenshots/review checkpoints are retained as history; they do not describe the current UI.

The owner already had this viewer running. Only its positively identified process was restarted to load the additive relationship-role schema. It remains available at `http://127.0.0.1:4377`; no unrelated process was stopped. If it is stopped later, run `Start-Viewer.cmd` or `npm start` in this project.
