import dagre from "@dagrejs/dagre";

export function resolveCatalog(
  catalog,
  { project = "", mapId = "", showArchived = false } = {},
) {
  const eligible = catalog.filter((map) => showArchived || !map.deleted);
  const candidates = eligible.filter((map) => map.project === project);
  const map =
    candidates.find((map) => map.id === mapId) ??
    candidates.find((map) => !map.deleted) ??
    candidates[0] ??
    eligible.find((map) => !map.deleted) ??
    eligible[0];
  return { project: map?.project ?? "", mapId: map?.id ?? "" };
}

export const itemKey = (item) => JSON.stringify([item.type, item.id]);
export function selectItems(previous, requested, additive = false) {
  const unique = [
    ...new Map(requested.map((item) => [itemKey(item), item])).values(),
  ];
  if (!additive) return unique;
  const next = new Map(previous.map((item) => [itemKey(item), item]));
  const remove = unique.every((item) => next.has(itemKey(item)));
  for (const item of unique)
    remove ? next.delete(itemKey(item)) : next.set(itemKey(item), item);
  return [...next.values()];
}
export function selectFromEvent(previous, requested, event = {}) {
  return selectItems(
    previous,
    requested,
    !!(event.ctrlKey || event.metaKey || event.shiftKey),
  );
}
// A pending load has no document. Never dereference the previous selection then.
export function selectionDetails(doc, items) {
  if (!doc) return [];
  return items.flatMap((item) => {
    const object = (item.type === "node" ? doc.nodes : doc.edges).find(
      (object) => object.id === item.id,
    );
    return object ? [{ ...item, label: object.title ?? object.label }] : [];
  });
}
export function selectionChanges(previous, changes, type) {
  if (!changes.some((change) => change.type === "select")) return previous;
  const next = new Map(previous.map((item) => [itemKey(item), item]));
  for (const change of changes)
    if (change.type === "select") {
      const item = { type, id: change.id };
      change.selected
        ? next.set(itemKey(item), item)
        : next.delete(itemKey(item));
    }
  const result = [...next.values()];
  return result.length === previous.length &&
    result.every((item, index) => itemKey(item) === itemKey(previous[index]))
    ? previous
    : result;
}
export function selectedRoots(items, edges) {
  return [
    ...new Set(
      items.flatMap((item) =>
        item.type === "node"
          ? [item.id]
          : edges
              .filter((edge) => edge.id === item.id)
              .flatMap((edge) => [edge.source, edge.target]),
      ),
    ),
  ];
}
export function projectView(doc, view, roots = null) {
  if (!doc || !view) return { nodes: [], edges: [] };
  const allowed = new Set(view.nodes);
  let ids = allowed;
  if (roots) {
    const chosen = new Set(roots.filter((id) => allowed.has(id)));
    ids = new Set(chosen);
    for (const edge of doc.edges)
      if (chosen.has(edge.source) || chosen.has(edge.target)) {
        if (allowed.has(edge.source)) ids.add(edge.source);
        if (allowed.has(edge.target)) ids.add(edge.target);
      }
  }
  return {
    nodes: doc.nodes.filter((node) => ids.has(node.id)),
    edges: doc.edges.filter(
      (edge) => ids.has(edge.source) && ids.has(edge.target),
    ),
  };
}
export const portId = (side, edge) =>
  encodeURIComponent(
    JSON.stringify([side, edge.label, edge.role ?? "reference"]),
  );
export function connectionPorts(edges, nodeId) {
  const ports = new Map();
  for (const edge of edges)
    for (const side of ["in", "out"])
      if ((side === "in" ? edge.target : edge.source) === nodeId) {
        const id = portId(side, edge);
        if (!ports.has(id))
          ports.set(id, {
            id,
            side,
            label: edge.label,
            role: edge.role ?? "reference",
            edges: [],
          });
        ports.get(id).edges.push(edge.id);
      }
  return [...ports.values()];
}
export function traceSelection(edges, items, preview = []) {
  const combined = [...items, ...preview],
    roots = new Set(
      combined.filter((item) => item.type === "node").map((item) => item.id),
    );
  const explicit = new Set(
    combined.filter((item) => item.type === "edge").map((item) => item.id),
  );
  const nodes = new Set(roots),
    tracedEdges = new Set();
  for (const edge of edges)
    if (
      explicit.has(edge.id) ||
      roots.has(edge.source) ||
      roots.has(edge.target)
    ) {
      tracedEdges.add(edge.id);
      nodes.add(edge.source);
      nodes.add(edge.target);
    }
  return { nodes, edges: tracedEdges, active: combined.length > 0 };
}

// Pure view-local layout. Callers own whether and how positions are persisted.
export function arrangeGraph(nodes, edges, direction = "TB") {
  if (!["TB", "LR"].includes(direction))
    throw new Error("Unsupported layout direction");
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({
    rankdir: direction,
    ranksep: direction === "LR" ? 140 : 85,
    nodesep: 70,
    marginx: 24,
    marginy: 24,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes)
    graph.setNode(node.id, {
      width: node.measured?.width ?? node.width ?? 242,
      height: node.measured?.height ?? node.height ?? 210,
    });
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of edges)
    if (ids.has(edge.source) && ids.has(edge.target))
      graph.setEdge(edge.source, edge.target, {}, edge.id);
  dagre.layout(graph);
  return Object.fromEntries(
    nodes.map((node) => {
      const placed = graph.node(node.id);
      return [
        node.id,
        { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 },
      ];
    }),
  );
}
