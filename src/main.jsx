import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useReactFlow,
  useNodesInitialized,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./style.css";

import SourceNode from "./SourceNode.jsx";
import { labels, relations } from "./presentation.js";
import {
  resolveCatalog,
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
import StructureEdge from "./StructureEdge.jsx";
import InspectionPanel from "./InspectionPanel.jsx";
import {
  restoreInspection,
  geometryKey,
  retainMeasurement,
  applyMeasurements,
  applyPositions,
  stablePreview,
  connectionGroups,
  connectionGeometry,
} from "../lib/canvas-model.mjs";
const nodeTypes = { source: SourceNode },
  edgeTypes = { structure: StructureEdge },
  EMPTY = Object.freeze({});
async function api(path, options) {
  const res = await fetch("/api/" + path, options);
  const v = await res.json();
  if (!res.ok) throw new Error(v.error);
  return v;
}
function App() {
  const [catalog, setCatalog] = useState([]),
    [mapId, setMapId] = useState(""),
    [record, setRecord] = useState(null),
    [history, setHistory] = useState([]),
    [viewId, setViewId] = useState(""),
    [items, setItems] = useState([]),
    [hovered, setHovered] = useState([]),
    [focused, setFocused] = useState([]),
    [query, setQuery] = useState(""),
    [focus, setFocus] = useState(null),
    [exploreRequest, setExploreRequest] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [help, setHelp] = useState(false),
    [project, setProject] = useState(""),
    [showArchived, setShowArchived] = useState(false);
  const [drafts, setDrafts] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("structure-viewer-drafts") ?? "{}",
      );
    } catch {
      return {};
    }
  });
  const flow = useReactFlow(),
    loadTicket = useRef(0);
  const doc = record?.document;
  const selection = items.length === 1 ? items[0] : null;
  const hoverEdges = useCallback(
    (ids) => setHovered((previous) => stablePreview(previous, ids)),
    [],
  );
  const focusEdges = useCallback(
    (ids) => setFocused((previous) => stablePreview(previous, ids)),
    [],
  );
  const setPreview = useCallback(() => {
    hoverEdges([]);
    focusEdges([]);
  }, [hoverEdges, focusEdges]);
  const preview = useMemo(
    () =>
      (hovered.length ? hovered : focused).map((id) => ({ type: "edge", id })),
    [hovered, focused],
  );
  const setSelection = useCallback(
    (item) => {
      setItems(item ? [item] : []);
      setPreview();
    },
    [setPreview],
  );
  function clearDocument() {
    setRecord(null);
    setSelection(null);
    setFocus(null);
  }
  const [layouts, setLayouts] = useState({}),
    [geometry, setGeometry] = useState({});
  const layoutKey = JSON.stringify([mapId, viewId]),
    layout = layouts[layoutKey] ?? EMPTY;
  const setLayout = useCallback(
    (updater) =>
      setLayouts((previous) => {
        const current = previous[layoutKey] ?? EMPTY,
          next = typeof updater === "function" ? updater(current) : updater;
        return next === current ? previous : { ...previous, [layoutKey]: next };
      }),
    [layoutKey],
  );
  const nodesRef = useRef([]),
    cameras = useRef(new Map()),
    lastFrame = useRef(""),
    lastExplore = useRef(0),
    inspectionContext = useRef(null),
    cameraTicket = useRef(0),
    currentLayoutKey = useRef(layoutKey),
    moveLayoutKey = useRef(layoutKey);
  currentLayoutKey.current = layoutKey;
  useEffect(() => {
    if (doc)
      inspectionContext.current = {
        documentId: doc.id,
        items,
        focus,
        query,
        viewId,
      };
  }, [doc, items, focus, query, viewId]);
  const initialized = useNodesInitialized();
  const latest = history.at(-1)?.revision,
    old = record && record.revision !== latest;
  const maps = catalog.filter(
    (m) => (!project || m.project === project) && (showArchived || !m.deleted),
  );
  const projects = [
    ...new Set(
      catalog.filter((m) => showArchived || !m.deleted).map((m) => m.project),
    ),
  ];
  async function refresh() {
    const v = await api("bootstrap");
    setToken(v.token);
    setCatalog(v.maps);
    return v.maps;
  }
  useEffect(() => {
    refresh().catch((error) => setError(error.message));
  }, []);
  useEffect(() => {
    const next = resolveCatalog(catalog, { project, mapId, showArchived });
    if (next.project !== project) setProject(next.project);
    if (next.mapId !== mapId) {
      setMapId(next.mapId);
      clearDocument();
      if (!next.mapId) {
        ++loadTicket.current;
        setBusy(false);
        setHistory([]);
        setItems([]);
        setPreview([]);
        setFocus(null);
      }
    }
  }, [catalog, project, mapId, showArchived]);
  async function load(id, revision) {
    const ticket = ++loadTicket.current;
    const previousContext = inspectionContext.current;
    setBusy(true);
    setError("");
    setMessage("");
    clearDocument();
    try {
      const [r, h] = await Promise.all([
        api(
          `maps/${encodeURIComponent(id)}${revision ? "?revision=" + revision : ""}`,
        ),
        api(`maps/${encodeURIComponent(id)}/history`),
      ]);
      if (ticket !== loadTicket.current) return;
      setRecord(r);
      setHistory(h);
      const restored = restoreInspection(r.document, previousContext);
      setItems(restored.items);
      setFocus(restored.focus);
      setQuery(restored.query);
      setViewId(restored.viewId);
    } catch (e) {
      if (ticket === loadTicket.current) setError(e.message);
    } finally {
      if (ticket === loadTicket.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (mapId) load(mapId);
  }, [mapId]);
  const view = doc?.views.find((v) => v.id === viewId) ?? doc?.views[0];
  const visible = useMemo(
    () => projectView(doc, view, focus),
    [view, doc, focus],
  );
  const matching =
    doc?.nodes.filter((n) =>
      [
        n.title,
        n.summary,
        n.body,
        n.id,
        ...n.sources.map((s) => s.file + " " + (s.symbol ?? "")),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ) ?? [];
  const matchingIds = new Set(matching.map((n) => n.id));
  const selectedNode =
    selection?.type === "node"
      ? doc?.nodes.find((n) => n.id === selection.id)
      : null;
  const selectedEdge =
    selection?.type === "edge"
      ? doc?.edges.find((e) => e.id === selection.id)
      : null;
  const noteTarget = selectedNode?.id ?? null,
    draftKey = JSON.stringify([doc?.id, record?.revision, noteTarget]),
    note = drafts[draftKey] ?? "";
  function setNote(value) {
    setDrafts((previous) => {
      const next = { ...previous };
      if (value) next[draftKey] = value;
      else delete next[draftKey];
      try {
        localStorage.setItem("structure-viewer-drafts", JSON.stringify(next));
      } catch {
        setError(
          "Draft backup unavailable. Keep a copy of your question until saved.",
        );
      }
      return next;
    });
  }
  const visibleNodeIds = useMemo(
    () => new Set(visible.nodes.map((node) => node.id)),
    [visible.nodes],
  );
  const visibleEdgeIds = useMemo(
    () => new Set(visible.edges.map((edge) => edge.id)),
    [visible.edges],
  );
  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        (item.type === "node" ? visibleNodeIds : visibleEdgeIds).has(item.id),
      ),
    [items, visibleNodeIds, visibleEdgeIds],
  );
  const selectionOutside = visibleItems.length < items.length;
  const trace = useMemo(
    () => traceSelection(visible.edges, visibleItems, preview),
    [visible.edges, visibleItems, preview],
  );
  const selectedNodeIds = useMemo(
    () =>
      new Set(
        items.filter((item) => item.type === "node").map((item) => item.id),
      ),
    [items],
  );
  const selectedEdgeIds = useMemo(
    () =>
      new Set(
        items.filter((item) => item.type === "edge").map((item) => item.id),
      ),
    [items],
  );
  const selectPort = useCallback(
    (ids, event) => {
      setPreview();
      const modifiers = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      };
      setItems((previous) =>
        selectFromEvent(
          previous,
          ids.map((id) => ({ type: "edge", id })),
          modifiers,
        ),
      );
    },
    [setPreview],
  );
  const chooseNode = useCallback(
    (id, event = {}) => {
      setPreview();
      const modifiers = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      };
      setItems((previous) =>
        selectFromEvent(previous, [{ type: "node", id }], modifiers),
      );
    },
    [setPreview],
  );
  const focusItems = useCallback(
    (chosen = items) => {
      if (!doc || busy) return;
      const roots = selectedRoots(chosen, doc.edges).filter((id) =>
        view?.nodes.includes(id),
      );
      if (roots.length) {
        setFocus((previous) =>
          previous &&
          previous.length === roots.length &&
          previous.every((id, i) => id === roots[i])
            ? previous
            : roots,
        );
        setQuery("");
        setExploreRequest((value) => value + 1);
        setPreview();
      }
    },
    [doc, busy, items, view, setPreview],
  );
  const ports = useMemo(
    () =>
      new Map(
        visible.nodes.map((node) => [
          node.id,
          connectionPorts(visible.edges, node.id),
        ]),
      ),
    [visible],
  );
  const nodes = useMemo(
    () =>
      visible.nodes.map((node, index) =>
        retainMeasurement(
          {
            id: node.id,
            type: "source",
            selectable: false,
            selected: selectedNodeIds.has(node.id),
            position: (Object.hasOwn(layout, node.id)
              ? layout[node.id]
              : undefined) ??
              (Object.hasOwn(view.positions, node.id)
                ? view.positions[node.id]
                : undefined) ?? {
                x: (index % 3) * 350,
                y: Math.floor(index / 3) * 230,
              },
            data: {
              ...node,
              geometryKey: geometryKey(node, ports.get(node.id)),
              ports: ports.get(node.id),
              selectedEdges: selectedEdgeIds,
              tracedEdges: trace.edges,
              traced: trace.nodes.has(node.id),
              onHover: hoverEdges,
              onFocus: focusEdges,
              onPortSelect: selectPort,
              dim: query.trim()
                ? !matchingIds.has(node.id)
                : trace.active && !trace.nodes.has(node.id),
            },
            ariaLabel:
              node.title + ". " + labels[node.evidence] + ". " + node.summary,
          },
          geometry,
        ),
      ),
    [
      visible.nodes,
      view,
      layout,
      geometry,
      selectedNodeIds,
      selectedEdgeIds,
      trace,
      query,
      ports,
      hoverEdges,
      focusEdges,
      selectPort,
    ],
  );
  nodesRef.current = nodes;
  const groups = useMemo(
    () => connectionGroups(visible.edges),
    [visible.edges],
  );
  const edges = useMemo(
    () =>
      groups.map((group) => {
        const edge = group.edge,
          appearance = relations[edge.role ?? "reference"],
          chosen = group.members.filter((id) => selectedEdgeIds.has(id)).length,
          traced = group.members.some((id) => trace.edges.has(id));
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          ...connectionGeometry(edge, nodes),
          type: "structure",
          selectable: false,
          selected: chosen > 0,
          data: {
            members: group.members,
            cards: connectionGeometry(edge, nodes).cards,
          },
          style: {
            stroke: appearance.color,
            strokeWidth: traced ? 2.5 : 1.5,
            strokeDasharray: appearance.dash,
            opacity: trace.active && !traced ? 0.2 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: appearance.color,
            width: 12,
            height: 12,
          },
          ariaLabel:
            edge.label +
            ": " +
            edge.source +
            " to " +
            edge.target +
            (group.members.length > 1
              ? " · " + group.members.length + " records"
              : ""),
        };
      }),
    [groups, nodes, selectedEdgeIds, trace],
  );
  const onNodesChange = useCallback(
    (changes) => {
      setGeometry((previous) =>
        applyMeasurements(previous, changes, nodesRef.current),
      );
      setLayout((previous) => applyPositions(previous, changes));
    },
    [setLayout],
  );
  const afterCanvas = useCallback(
    (action) => {
      const ticket = ++cameraTicket.current,
        key = layoutKey;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (
            ticket === cameraTicket.current &&
            currentLayoutKey.current === key &&
            nodesRef.current.length
          )
            action();
        }),
      );
    },
    [layoutKey],
  );
  const fit = useCallback(
    (selected = false) => {
      const ids = selected && doc ? selectedRoots(items, doc.edges) : null;
      afterCanvas(() =>
        flow.fitView({
          padding: 0.12,
          duration: 200,
          maxZoom: 1.1,
          ...(ids ? { nodes: ids.map((id) => ({ id })) } : {}),
        }),
      );
    },
    [flow, items, doc, afterCanvas],
  );
  useEffect(() => {
    if (!doc || !initialized || lastFrame.current === layoutKey) return;
    afterCanvas(() => {
      lastFrame.current = layoutKey;
      const camera = cameras.current.get(layoutKey);
      if (camera) flow.setViewport(camera);
      else
        flow.fitView({
          nodes: nodesRef.current.map((node) => ({ id: node.id })),
          padding: 0.12,
          maxZoom: 1,
        });
    });
  }, [doc, initialized, layoutKey, flow, afterCanvas]);
  useEffect(() => {
    if (!initialized || lastExplore.current === exploreRequest) return;
    lastExplore.current = exploreRequest;
    afterCanvas(() =>
      flow.fitView({ padding: 0.12, duration: 200, maxZoom: 1 }),
    );
  }, [exploreRequest, initialized, flow, afterCanvas]);
  function arrange(direction = "TB") {
    if (!nodes.length) return;
    setLayout((previous) => ({
      ...previous,
      ...arrangeGraph(flow.getNodes(), visible.edges, direction),
    }));
    setTimeout(() => fit(), 100);
  }
  function restoreLayout() {
    setLayout({});
    setTimeout(() => fit(), 100);
  }
  function keyboardSelection(event) {
    if (event.key === "Escape") {
      setSelection(null);
      event.stopPropagation();
      return;
    }
    if (
      !["Enter", " "].includes(event.key) ||
      event.target.closest("button,input,textarea,select")
    )
      return;
    const object = event.target.closest(".react-flow__node,.react-flow__edge");
    if (!object) return;
    const id = object.getAttribute("data-id");
    event.preventDefault();
    event.stopPropagation();
    if (object.classList.contains("react-flow__node")) chooseNode(id, event);
    else
      selectPort(
        edges.find((edge) => edge.id === id)?.data.members ?? [id],
        event,
      );
  }
  function jump(id) {
    const v = view?.nodes.includes(id)
      ? view
      : doc.views.find((v) => v.nodes.includes(id));
    if (!v) {
      setError("This node is not included in an authored view.");
      return;
    }
    setViewId(v.id);
    setFocus(null);
    chooseNode(id);
    setQuery("");
  }
  async function saveNote() {
    if (!note.trim() || old || record.deleted || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api(`maps/${mapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          expectedRevision: record.revision,
          author: "Radzi",
          summary: `Owner question${noteTarget ? " on " + noteTarget : ""}`,
          operations: [
            {
              op: "addNote",
              nodeId: noteTarget ?? undefined,
              text: note.trim(),
            },
          ],
        }),
      });
      setNote("");
      setRecord(r);
      setHistory(await api(`maps/${mapId}/history`));
      await refresh();
      setMessage("Question saved as revision " + r.revision + ".");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function exportMap() {
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
        type: "application/json",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${mapId}-r${record.revision}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <div className="app">
      <header className="appbar">
        <div className="brand">
          <span className="brandmark">⌘</span>
          <div>
            <strong>
              Structure<span>Viewer</span>
            </strong>
          </div>
        </div>
        <div className="app-actions">
          <span className="local">
            <i /> Local workspace
          </span>
          <button onClick={() => setHelp(!help)} aria-expanded={help}>
            Agent guide
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-label">WORKSPACE</div>
          <label>
            Project
            <select
              aria-label="Project"
              value={project}
              onChange={(e) => {
                const p = e.target.value;
                setProject(p);
                const chosen = resolveCatalog(catalog, {
                  project: p,
                  showArchived,
                });
                const m = catalog.find((map) => map.id === chosen.mapId);
                setMapId(m?.id ?? "");
                clearDocument();
              }}
            >
              {projects.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Explanation
            <select
              aria-label="Explanation"
              value={mapId}
              onChange={(e) => setMapId(e.target.value)}
            >
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                  {m.deleted ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="section-head">
            <span>VIEWPOINTS</span>
            <span>{doc?.views.length ?? 0}</span>
          </div>
          <nav aria-label="Viewpoints">
            {doc?.views.map((v, i) => (
              <button
                key={v.id}
                className={"view-button " + (viewId === v.id ? "active" : "")}
                onClick={() => {
                  setViewId(v.id);
                  setFocus(null);
                  setPreview();
                }}
              >
                <span className="view-number">0{i + 1}</span>
                <span>
                  <strong>{v.title}</strong>
                  <small>{v.nodes.length} nodes</small>
                </span>
              </button>
            ))}
          </nav>
          <div className="section-head">
            <span>FIND IN THIS MAP</span>
            <span>⌕</span>
          </div>
          <input
            aria-label="Search nodes"
            placeholder="Name, concept, file…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="node-list">
            {(query.trim() ? matching : visible.nodes).map((n) => (
              <button
                key={n.id}
                className={selectedNodeIds.has(n.id) ? "active" : ""}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey)
                    chooseNode(n.id, event);
                  else jump(n.id);
                }}
              >
                <span className="node-list-icon">
                  {n.kind.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  {n.title}
                  <small>{n.kind}</small>
                </span>
              </button>
            ))}
            {query.trim() && !matching.length && (
              <p className="muted">No matching nodes. Try another term.</p>
            )}
          </div>
          <div className="sidebar-bottom">
            <button
              onClick={async () => {
                await refresh();
                if (mapId) await load(mapId);
              }}
            >
              ↻ Refresh from agent
            </button>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />{" "}
              Include archived maps
            </label>
            <p>
              Authored explanations.
              <br />
              Source code stays untouched.
            </p>
          </div>
        </aside>
        <main>
          <div className="map-heading">
            <div>
              <div className="eyebrow">
                {doc?.project ?? "WORKSPACE"} <span>/ EXPLANATIONS</span>
              </div>
              <h1>{view?.title ?? "Your shared map"}</h1>
              <p>{view?.description ?? "Select an explanation to begin."}</p>
            </div>
          </div>
          <div className="toolbar">
            <div className="scope-switch">
              <button
                className={!focus ? "pressed" : ""}
                onClick={() => {
                  setFocus(null);
                  setExploreRequest((value) => value + 1);
                }}
              >
                All in view
              </button>
              <button
                className={focus ? "pressed" : ""}
                disabled={!items.length || !doc || busy}
                onClick={() => focusItems()}
              >
                Connections
              </button>
            </div>
            <span className="count">
              {visible.nodes.length} nodes · {visible.edges.length} connections
              {items.length
                ? " · " +
                  items.length +
                  " selected" +
                  (selectionOutside ? " (outside view)" : "")
                : ""}
            </span>
            <details className="view-menu">
              <summary>View</summary>
              <div
                role="menu"
                onClick={(event) =>
                  event.currentTarget.closest("details").removeAttribute("open")
                }
              >
                <button onClick={() => fit()}>Fit all</button>
                <button disabled={!items.length} onClick={() => fit(true)}>
                  Fit selection
                </button>
                <button onClick={() => arrange("TB")}>Arrange down</button>
                <button onClick={() => arrange("LR")}>Arrange right</button>
                <button
                  disabled={!Object.keys(layout).length}
                  onClick={restoreLayout}
                >
                  Restore authored positions
                </button>
              </div>
            </details>
          </div>
          {error && (
            <div role="alert" className="banner error">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {message && (
            <div role="status" className="banner">
              {message}
              <button
                onClick={() => setMessage("")}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}
          {old && (
            <div className="banner historical">
              Viewing saved revision {record.revision}. Questions can be added
              to the latest revision.
              <button onClick={() => load(mapId)}>Return to latest</button>
            </div>
          )}
          {record?.deleted && (
            <div className="banner historical">
              Archived map. Its history is preserved; an agent can restore it.
            </div>
          )}
          <section
            className="canvas"
            aria-label="Structure canvas"
            aria-busy={busy}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              nodesConnectable={false}
              nodesDraggable={true}
              deleteKeyCode={null}
              minZoom={0.2}
              maxZoom={1.8}
              edgeTypes={edgeTypes}
              nodesFocusable
              edgesFocusable
              selectNodesOnDrag={false}
              selectionKeyCode={null}
              multiSelectionKeyCode={null}
              autoPanOnNodeFocus={false}
              zoomOnDoubleClick={false}
              elevateNodesOnSelect={false}
              elevateEdgesOnSelect={false}
              onNodeClick={(event, node) => chooseNode(node.id, event)}
              onEdgeClick={(event, edge) =>
                selectPort(edge.data.members, event)
              }
              onEdgeMouseEnter={(_, edge) => hoverEdges(edge.data.members)}
              onEdgeMouseLeave={() => hoverEdges([])}
              onPaneClick={() => setSelection(null)}
              onNodesChange={onNodesChange}
              onMoveStart={() => {
                moveLayoutKey.current = layoutKey;
              }}
              onMoveEnd={(_, viewport) => {
                if (doc && moveLayoutKey.current === layoutKey)
                  cameras.current.set(layoutKey, viewport);
              }}
              onKeyDownCapture={keyboardSelection}
            >
              <Background color="#d9e0eb" gap={20} size={1} />
              <Controls showInteractive={false} showFitView={false} />
              {visible.nodes.length > 8 && (
                <MiniMap pannable zoomable nodeColor="#cad7ed" />
              )}
            </ReactFlow>
            {!doc && (
              <div className="empty">
                {busy ? "Loading explanation…" : "No explanation selected"}
              </div>
            )}
          </section>
        </main>
        <InspectionPanel
          doc={doc}
          items={items}
          setItems={setItems}
          onPreview={hoverEdges}
          onFocus={focusEdges}
          onSelectEdges={selectPort}
          record={record}
          history={history}
          busy={busy}
          old={old}
          note={note}
          setNote={setNote}
          saveNote={saveNote}
          exportMap={exportMap}
          load={load}
          mapId={mapId}
        />
      </div>
      {help && (
        <div className="dialog-backdrop">
          <section
            className="guide"
            onKeyDown={(event) => {
              if (event.key === "Escape") setHelp(false);
              if (event.key === "Tab") event.preventDefault();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Agent authoring guide"
          >
            <button className="close" onClick={() => setHelp(false)} autoFocus>
              Close ×
            </button>
            <div className="eyebrow">HUMAN + AGENT</div>
            <h2>One map. A shared conversation.</h2>
            <p>
              Ask your coding agent to explore the repository and author a map
              using this project's <code>AGENT-GUIDE.md</code>. No parser or AI
              backend is needed.
            </p>
            <ol>
              <li>Choose a project and viewpoint. Start with the overview.</li>
              <li>
                Select nodes and connections to understand the code and
                evidence.
              </li>
              <li>
                Save questions. Ask your agent to read them and revise the map.
              </li>
              <li>Refresh, then compare saved revisions using the selector.</li>
            </ol>
            <pre>
              node cli.mjs list{"\n"}node cli.mjs get vict-designer{"\n"}node
              cli.mjs history vict-designer
            </pre>
            <p>
              Agents edit JSON documents or submit validated CRUD operations
              through the CLI. Every change requires a base revision, author and
              summary. Prior revisions remain intact.
            </p>
            <p className="muted">
              This viewer never executes map content or edits the mapped
              repository. Source references are readable citations.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <ReactFlowProvider>
    <App />
  </ReactFlowProvider>,
);
