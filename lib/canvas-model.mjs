import { portId } from "./view-model.mjs";

export function restoreInspection(doc, context) {
  const same = doc.id === context?.documentId,
    nodes = new Set(doc.nodes.map((node) => node.id)),
    edges = new Set(doc.edges.map((edge) => edge.id));
  const view =
    (same && doc.views.find((view) => view.id === context.viewId)) ||
    doc.views[0];
  const roots =
    same && context.focus
      ? context.focus.filter((id) => nodes.has(id) && view.nodes.includes(id))
      : [];
  return {
    items: same
      ? context.items.filter((item) =>
          (item.type === "node" ? nodes : edges).has(item.id),
        )
      : [],
    focus: roots.length ? roots : null,
    query: same ? context.query : "",
    viewId: view.id,
  };
}

// Only content that can change card/port geometry belongs in this signature.
// Selection, tracing and callbacks must never invalidate measured dimensions.
export function geometryKey(node, ports) {
  return JSON.stringify([
    node.id,
    node.title,
    node.kind,
    node.summary,
    ports.map((port) => [port.id, port.edges.length]),
  ]);
}
export function retainMeasurement(node, geometry) {
  const measured = geometry[node.data.geometryKey];
  return measured ? { ...node, measured } : node;
}
export function applyMeasurements(previous, changes, nodes) {
  let next = previous;
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  for (const change of changes) {
    if (change.type !== "dimensions" || !change.dimensions) continue;
    const node = lookup.get(change.id);
    if (!node) continue;
    const { width, height } = change.dimensions;
    if (!(width > 0 && height > 0)) continue;
    const key = node.data.geometryKey,
      old = next[key];
    if (old?.width === width && old?.height === height) continue;
    if (next === previous) next = { ...previous };
    next[key] = { width, height };
  }
  return next;
}
export function applyPositions(previous, changes) {
  let next = previous;
  for (const change of changes) {
    if (change.type !== "position" || !change.position) continue;
    const { x, y } = change.position,
      old = next[change.id];
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      (old?.x === x && old?.y === y)
    )
      continue;
    if (next === previous) next = { ...previous };
    next[change.id] = { x, y };
  }
  return next;
}
export function stablePreview(previous, requested) {
  const ids = [...new Set(requested)].sort();
  return previous.length === ids.length &&
    previous.every((id, i) => id === ids[i])
    ? previous
    : ids;
}
export function edgeGroupKey(edge) {
  return JSON.stringify([
    edge.source,
    edge.target,
    edge.label,
    edge.role ?? "reference",
    edge.evidence,
    edge.body,
  ]);
}
export function connectionGroups(edges) {
  const groups = new Map();
  for (const edge of edges) {
    const key = edgeGroupKey(edge);
    if (!groups.has(key)) groups.set(key, { edge, members: [] });
    groups.get(key).members.push(edge.id);
  }
  return [...groups.values()];
}

export function connectionGeometry(edge, nodes) {
  const cards = nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? 224,
    height: node.measured?.height ?? 180,
  }));
  return {
    sourceHandle: portId("out", edge),
    targetHandle: portId("in", edge),
    cards,
  };
}

// Fixed outgoing-right/incoming-left sockets. Backward connections take a
// clear outside lane instead of secretly using unlabeled top/bottom sockets.
export function feedbackRoute(source, target, cards) {
  const right = source.x + 28,
    left = target.x - 28;
  const crossed = cards.filter(
    (card) =>
      card.x < Math.max(right, left) &&
      card.x + card.width > Math.min(right, left),
  );
  const top =
    Math.min(source.y, target.y, ...crossed.map((card) => card.y)) - 28;
  const bottom =
    Math.max(
      source.y,
      target.y,
      ...crossed.map((card) => card.y + card.height),
    ) + 28;
  const lane =
    Math.abs(source.y - top) + Math.abs(target.y - top) <=
    Math.abs(source.y - bottom) + Math.abs(target.y - bottom)
      ? top
      : bottom;
  const points = [
    source,
    { x: right, y: source.y },
    { x: right, y: lane },
    { x: left, y: lane },
    { x: left, y: target.y },
    target,
  ];
  return points
    .map((point, index) => `${index ? "L" : "M"} ${point.x},${point.y}`)
    .join(" ");
}
