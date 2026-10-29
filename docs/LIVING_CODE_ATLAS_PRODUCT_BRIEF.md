# Structure Viewer Living Code Atlas Product Brief

Version: 0.1  
Date: 30 October 2026  
Status: Proposed development reference  
Product repository: https://github.com/radz2291/structure-viewer

This proposal defines the product direction and a bounded first release. It does not authorize implementation, changes to inspected repositories, or deployment.

## 1 Product definition

Structure Viewer is a local-first engineering inspection workspace that turns a repository into a navigable, source-linked graph. It keeps that graph synchronized with a selected source state and lets a coding agent explain the system without becoming the authority for its structural facts.

The working concept is **Living Code Atlas**. Keep Structure Viewer as the product and repository name for now.

**Product promise:** See how your software is connected, inspect the code behind every supported relationship, understand what changed, and progressively learn to evaluate the system yourself.

The initial audience is non-technical and emerging technical builders who develop software through AI agents. Experienced developers can use the same workspace for orientation and review. The product supports a path toward engineering proficiency; it does not certify competence or replace software engineering fundamentals.

## 2 Problem and intended outcome

AI-assisted builders can produce working applications faster than they develop a reliable understanding of them. They often depend on the agent to explain what changed, diagnose failures, and decide whether a feature really works.

A chat explanation disappears into conversation. A hand-drawn map becomes outdated. A file tree shows location but not behavior. A runtime trace shows one execution but not every possible path.

Structure Viewer should connect these representations without pretending they are equivalent.

The owner should be able to:

- Locate a feature's entry point, relevant components, and code.
- Follow a supported relationship and inspect why the connection exists.
- Distinguish a declaration, a possible execution path, and an observed run.
- Review an agent's changes against actual source and relevant evidence.
- Preserve questions and understanding as the repository evolves.
- Progress from navigation to explanation, investigation, evaluation, and supervised change.

## 3 Product principles

### Source is the authority

Mechanically derived nodes and edges must have recoverable evidence. A node is not verified merely because an agent labels it observed. Every displayed subset must identify its source snapshot and analysis coverage.

### Interpretation is a separate layer

The agent translates verified structure into plain language, proposes conceptual groupings, and explains likely consequences. Its interpretations reference source facts but cannot overwrite them or silently become verified relationships.

### Execution is a separate kind of evidence

A statically resolved call site does not prove the function ran. A declared edge does not prove data traversed it. Runtime evidence, when introduced, must identify its run, source/build identity, environment, and coverage. A successful run does not establish universal correctness.

### Navigation works in both directions without editing code

Users can move from a graph object to source and from a selected source symbol to related graph objects. This is navigational linkage, not automatic graph-to-code generation.

### Exploration stays lightweight

Show a small, meaningful neighborhood first, with explicit expansion and collapse. The full indexed graph is not the same thing as the visible canvas. Keep the agent optional for basic browsing.

### Ownership grows through practice

Support prediction, evidence inspection, and investigation during real work. Do not force quizzes, gamified rankings, or a fixed curriculum into normal browsing.

## 4 Core user experience

1. **Choose a repository and scope.** Select a local repository, a source state, and an initial folder or entry point.
2. **Orient.** See a small structural overview and a clear indication of what is indexed, excluded, unresolved, or out of date.
3. **Inspect.** Select a node to see responsibility, actual code, callers, dependencies, contracts where supported, and evidence.
4. **Follow a connection.** Select an edge or connection point to inspect its meaning and the code supporting that relationship.
5. **Trace a question.** Ask, for example, “Where does this message go?” The agent proposes a bounded viewpoint supported by source anchors. Unknown links remain visible.
6. **Review a change.** Compare two snapshots. Separate implementation edits from topology changes and potential downstream impact.
7. **Retain understanding.** Notes, bookmarks, viewpoints, and questions stay attached to stable identities or remain explicitly historical when their targets disappear.

Preserve the existing calm canvas, labeled incoming/outgoing connection rows, stable selection, camera, and inspector. Hover must never trigger layout changes or camera movement.

Use the existing Selection and Document model. Add source inspection within that model, not a separate application. Document owns repository/snapshot identity, scope, freshness, limitations, and export. Selection owns the chosen object, code, relationships, evidence, and questions.

Design a narrow-screen inspector/drawer and list alternative without assuming a phone can reach a loopback-only desktop server. Remote access is a separate product and security decision.

## 5 Product lenses

| Lens | Question | Release |
| --- | --- | --- |
| Structure | What exists, what contains it, and what references or calls it? | MVP |
| Source flow | What path is declared or statically supported, and what remains unresolved? | MVP, bounded coverage |
| Changes | What changed between source snapshots and what may be affected? | MVP |
| Runtime | What happened in this particular recorded execution? | Later |
| Ownership | Can I explain, predict, investigate, and evaluate this area? | Optional guided workflow; advanced tracking later |

These are views over shared identities and evidence, not independent maps that drift apart. Compound concept nodes must expose their underlying members. Proposed architecture must remain visibly separate from implemented structure.

## 6 Evidence and identity model

Keep relationship meaning, evidence origin, and freshness as separate fields.

| Record | Required responsibility |
| --- | --- |
| Source snapshot | Repository identity; immutable commit SHA or captured working-tree manifest with retained approved source bytes; capture time; scope; relevant configuration fingerprint; analysis version and status |
| Source anchor | Snapshot; repository-relative file; symbol context; source span; content fingerprint; mapping status |
| Code entity | Stable application ID; kind; name; source anchors; identity lineage across snapshots |
| Relationship | Source/target IDs; precise relation type; supporting anchors; extraction rule or author; resolution status |
| Explanation | Agent/human interpretation; supporting entity/edge IDs; dependency fingerprints; review/freshness status |
| Viewpoint and annotation | Selected entities, grouping/layout, questions and notes; source and explanation revision context |

Every machine-derived edge needs its own evidence, not merely citations attached to its endpoint nodes.

Use explicit relationship types such as contains, imports, references, static-call-site, binds-capability, declares-flow, and declares-contract. Existing color roles can style these relationships but must not substitute for their meaning.

Evidence origins should distinguish source extraction, agent interpretation, owner assertion, proposed change, and later runtime observation. Show clear states such as current, indexing, stale, unresolved, unsupported, and failed. Avoid invented numerical confidence scores.

Line numbers alone are not stable identities. Use symbol context, source fingerprints, and conservative lineage matching. Rename/move matching can be ambiguous. Preserve unmatched notes as historical/orphaned; never silently reattach them to a different function.

Keep source snapshots, explanation revisions, and temporary presentation state separate. A layout drag must not become a source change.

Historical source inspection requires bytes, not only hashes. Retain approved working-tree source in a local content-addressed snapshot store, separate from the rebuildable analysis cache. Define retention and eviction controls; preserve owner-pinned snapshots. If historical bytes or Git objects are unavailable, show source unavailable rather than substituting current code. Retain annotations and snapshot metadata when source retention ends.

## 7 Git synchronization rules

The MVP watches one selected local repository while the viewer is running. It detects saved file changes and changes to the selected branch or commit. It reconciles again at startup and supports manual refresh.

Distinguish:

- **Working tree:** saved local changes, including selected untracked files; not unsaved editor buffers.
- **Local commit:** the checked-out commit or explicitly selected historical commit.
- **Remote reference:** the last locally fetched remote state, not guaranteed current GitHub state.
- **Running build:** unknown unless separately linked to execution evidence.

Do not label the graph “synced” without naming the source state and scope.

The update sequence is:

1. Detect a possible change and mark affected analysis pending.
2. Capture a coherent source snapshot. If files or refs change during capture, retry or report the unstable capture.
3. Reanalyse changed files and affected dependents. Configuration, dependency-resolution, and adapter changes may require wider invalidation.
4. Produce added, changed, removed, and unresolved graph records.
5. Publish a coherent new index revision; preserve the previous one.
6. Mark dependent interpretations as needing review when their evidence changes.
7. Refresh explanations selectively through the existing agent workflow.

A changed function body need not change the graph topology. A changed edge declaration does. Potential downstream impact must be labeled as analysis, not as proof that those components broke.

If parsing fails during an unfinished edit, retain the last valid graph with a stale/error indication. Never display the old graph as current or replace it with a misleading empty graph. Preserve selection and layout where identities remain valid.

GitHub webhook/polling support is later scope. The MVP performs no automatic checkout, commit, push, reset, or network fetch.

## 8 MVP scope

**Release objective:** Deliver a trustworthy Code–Structure–Git loop using the existing Structure Viewer.

Include:

- One local repository at a time; selected TypeScript/JavaScript scope.
- A supported subset of modules, declarations, imports, references, and statically resolvable call sites.
- Exact source viewing for nodes and edges, from the indexed snapshot.
- A bounded VICT adapter for statically readable graph declarations, capability IDs/bindings, and contract references.
- Local working-tree and commit change detection, snapshot comparison, and structural diffs.
- Separate generated facts and authored explanations, with the current coding agent able to contribute through a validated interface.
- Preserved notes, authored viewpoints, historical maps, and explicit freshness/coverage states.

Exclude:

- Automatic source editing, deployment, dependency installation, or target-code execution.
- Complete whole-program call graphs, guaranteed end-to-end dataflow, or correctness proofs.
- Arbitrary computed registrations, reflection, runtime-generated code, or unsupported framework semantics.
- Full multi-language support; Svelte/framework behavior requires later adapters.
- A new hosted AI backend, public hosting, multi-user collaboration, or automatic background agents.
- Runtime instrumentation/playback and certification of engineering proficiency.

Unsupported constructs must be reported, not approximated as established facts. The VICT adapter is a plugin to a generic model, not the model's universal vocabulary.

## 9 Architecture and integration

Retain the existing React Flow interface, local Node server, CLI/API authoring, and immutable revision history. Do not introduce a VICT runtime dependency or rewrite the application to begin.

Add these boundaries:

1. **Repository reader and change detector:** constrained read-only access to approved files and Git state.
2. **Language indexer:** TypeScript compiler/language-service facilities for the supported syntax and symbol relationships.
3. **Framework adapters:** bounded interpretation of known declarative APIs, starting with VICT.
4. **Source graph and snapshot store:** reproducible derived records with anchors, analysis status, and diffs.
5. **Explanation service boundary:** the existing coding agent reads bounded graph/source slices and writes only interpretations, viewpoints, and proposals.
6. **Viewer projection:** creates a manageable canvas from selected facts and overlays.

The agent interface needs bounded reads for entities, source, neighborhoods, and snapshot diffs; revision-guarded writes for explanations and viewpoints; and a way to read owner questions. It does not need an autonomous queue in the MVP.

Enforce ownership of generated facts when M2 is introduced: authoring endpoints must reject edits to extractor-owned records and forged source-extraction evidence. Only the indexing path produces those records. This is an application integrity boundary within a trusted local workstation, not protection against an unrestricted local process rewriting files.

Separate the rebuildable index/cache from durable owner notes. Keep both outside inspected repositories by default. Choose storage based on measured scope; neither a graph database nor a new orchestration framework is mandatory.

Preserve existing schema-version-1 documents and histories. Treat their observed labels as authored assertions. Introduce source-backed records through an explicit versioned schema/adapter; never silently upgrade old labels into verified facts or destructively migrate existing maps.

## 10 Safety and trust boundaries

Analysis must not import or execute inspected modules, run package scripts or Git hooks, install dependencies, or load executable repository configuration/plugins. Use declarative parsing and constrained Git reads.

Git reads must disable external diff helpers, text conversion, executable filesystem-monitor hooks, and pagers. Validate revision/path arguments, avoid shell interpolation, and bound subprocess resources. Test that repository-configured helpers are not executed during inspection.

Respect the selected repository root, exclusions, symlink boundaries, file-size limits, and resource budgets. Exclude secrets, credentials, environment files, generated artifacts, dependencies, and binary files by default; overrides require explicit selection.

Repository text is evidence, not authority to instruct the agent. Source and traces must not be sent to a model or remote service without the configured, approved workflow. Do not promise that automatic secret detection is complete.

Code-change requests remain a separate supervised workflow: explain the intended change and impact, obtain explicit authorization, then verify the result. A changed graph or successful index is not evidence that the application works.

## 11 Development sequence

| Milestone | Deliverable | Completion evidence |
| --- | --- | --- |
| M1 Source inspection | Read a pinned snapshot and connect existing map objects to real source | Node and edge selection reveal exact code; old authored maps still work |
| M2 Mechanical structure | Generic TypeScript/JavaScript extraction plus bounded VICT adapter | Reproduce supported entities and relations from fixtures without an LLM; unresolved cases remain visible; authoring API cannot forge or overwrite source facts |
| M3 Git awareness | Coherent snapshots, change detection, diff view, and interpretation invalidation | Body edits, topology edits, branch changes, deletion, and parsing failure produce the correct state |
| M4 Agent explanations and ownership | Evidence-linked interpretation, contextual questions, optional prediction/investigation workflow | Agent cannot mutate derived facts; notes and stale explanations survive updates |
| M5 Runtime evidence | Import or integrate traces linked to source/build identity | Observed executions remain distinct from possible static paths and unsupported coverage |

M1–M3 establish the first product release. Existing agent-authored explanations can remain available throughout; richer M4 behavior is incremental. M5 is not a prerequisite.

## 12 First acceptance demonstration

Use a temporary, isolated fixture derived from VICT's ara-proof example, not the active VICT worktree. Include a small generic TypeScript/JavaScript fixture so core behavior does not depend on VICT.

The demonstration must establish:

1. Extract the real four graph nodes and three declared edges, and link their supported capability bindings to source.
2. Select a node, flow edge, and binding relationship; inspect their exact supporting code and snapshot.
3. Change a capability body: show an implementation change without inventing a topology change.
4. Change a graph edge: show the corresponding structural diff and source diff.
5. Rename/move and then remove a symbol: preserve valid identity matches, flag ambiguity, and retain historical notes.
6. Have the developer or test harness switch the disposable fixture's branch/commit externally, then inspect an older snapshot in the viewer. Show matching structure and source; viewer snapshot selection must not alter the checkout. Exercise unavailable historical-source handling.
7. Introduce invalid syntax or an unsupported dynamic registration: expose incomplete analysis and retain the last valid state honestly.
8. Change relevant configuration or an imported contract: reanalyse affected dependents, not just the edited file.
9. Refresh and restart: preserve annotations, explanation revisions, selected context where valid, and existing legacy histories.
10. Verify read-only boundaries and interaction stability: no inspected-file writes, execution of repository-configured Git helpers, target-code execution, unexpected network transfer, flashing, selection-driven layout changes, or camera jumps.

Use focused automated fixtures for extraction, synchronization, identity, and persistence, plus a small manual UI check. Record actual results and limitations. Avoid large verification bureaucracy.

Target a few-second update on these small fixtures, measured on the owner's machine. Establish real timings before promising repository-wide scale.

## 13 Success measures

Product success is not the number of nodes generated.

Track whether users can:

- Find the responsible source and relevant callers with less assistance.
- Correctly predict a bounded behavior before revealing its result.
- Distinguish source claims, inferred impact, and observed execution.
- Locate the first missing piece of evidence in a failure.
- Explain and evaluate a small change, including risks and verification.
- Apply that reasoning to an unfamiliar variation with reduced agent help.

Assess ability per feature or subsystem, not with a single global engineering score. Store personal progress only when requested. Better understanding and safe decision-making are hypotheses to validate with real tasks.

Operational checks include source-link accuracy, stale-state detection, preservation of annotations, understandable failure states, and no unexpected repository writes.

## 14 Starting instruction for development

After the owner approves implementation, begin with M1 and the smallest complete path: choose a repository snapshot, select one real node or edge, inspect its actual source, and preserve the current viewer's behavior.

Read the repository's current instructions and inspect its baseline before changing it. Treat this brief as product direction, not permission to modify VICT, overwrite existing work, deploy, or expand scope. Update the brief when an approved product decision changes; keep implementation details replaceable.

## Reference baseline

The current application baseline is structure-viewer main at 14b4a946b0d599f2d024c2c0a9912090c4646b91. It is an agent-authored explanation viewer; the source indexer and Git synchronization described here are proposed additions.

- [Current product scope and interaction model](https://github.com/radz2291/structure-viewer/blob/14b4a946b0d599f2d024c2c0a9912090c4646b91/README.md)
- [Existing agent authoring contract](https://github.com/radz2291/structure-viewer/blob/14b4a946b0d599f2d024c2c0a9912090c4646b91/AGENT-GUIDE.md)
- [Current application instructions](https://github.com/radz2291/structure-viewer/blob/14b4a946b0d599f2d024c2c0a9912090c4646b91/AGENTS.md)
- [Existing document schema](https://github.com/radz2291/structure-viewer/blob/14b4a946b0d599f2d024c2c0a9912090c4646b91/lib/store.mjs)
- [VICT ara-proof reference snapshot](https://github.com/radz2291/vict-02/tree/d7401bef6e48330796c74ec00c86db9622d48cdf/examples/ara-proof)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript-wiki/blob/main/Using-the-Compiler-API.md)
- [Git status](https://git-scm.com/docs/git-status) and [Git diff](https://git-scm.com/docs/git-diff)

