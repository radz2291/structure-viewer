import React, { useState } from "react";
import { selectionDetails, selectFromEvent } from "../lib/view-model.mjs";
import { connectionGroups } from "../lib/canvas-model.mjs";
import { labels, relations } from "./presentation.js";

export default function InspectionPanel({
  doc,
  items,
  setItems,
  onPreview,
  onFocus,
  onSelectEdges,
  record,
  history,
  busy,
  old,
  note,
  setNote,
  saveNote,
  exportMap,
  load,
  mapId,
}) {
  const [tab, setTab] = useState("selection"),
    [page, setPage] = useState("overview");
  const details = selectionDetails(doc, items),
    single = items.length === 1 ? items[0] : null;
  const node =
      single?.type === "node"
        ? doc?.nodes.find((node) => node.id === single.id)
        : null,
    edge =
      single?.type === "edge"
        ? doc?.edges.find((edge) => edge.id === single.id)
        : null;
  const nodeIds = new Set(
      items.filter((item) => item.type === "node").map((item) => item.id),
    ),
    edgeIds = new Set(
      items.filter((item) => item.type === "edge").map((item) => item.id),
    );
  const related = connectionGroups(
    doc?.edges.filter(
      (edge) =>
        edgeIds.has(edge.id) ||
        nodeIds.has(edge.source) ||
        nodeIds.has(edge.target),
    ) ?? [],
  );
  const notes =
    doc?.notes.filter((question) => !node || question.nodeId === node.id) ?? [];
  const name = (id) => doc?.nodes.find((node) => node.id === id)?.title ?? id;
  const memberRows = [
    ...details
      .filter((item) => item.type === "node")
      .map((item) => ({
        id: "node-" + item.id,
        label: item.label,
        items: [{ type: "node", id: item.id }],
        icon:
          doc.nodes
            .find((node) => node.id === item.id)
            ?.kind.slice(0, 1)
            .toUpperCase() ?? "◇",
      })),
    ...connectionGroups(
      doc?.edges.filter((edge) => edgeIds.has(edge.id)) ?? [],
    ).map((group) => ({
      id: "edge-" + group.edge.id,
      label: `${name(group.edge.source)} → ${group.edge.label} → ${name(group.edge.target)}`,
      items: group.members.map((id) => ({ type: "edge", id })),
      icon: "↗",
    })),
  ];
  function selectObject(item, event) {
    setItems((previous) => selectFromEvent(previous, [item], event));
  }
  return (
    <aside className="inspector" aria-label="Inspection panel">
      <div className="inspector-tabs" role="tablist" aria-label="Inspection">
        <button
          role="tab"
          aria-selected={tab === "selection"}
          onClick={() => setTab("selection")}
        >
          Selection{details.length > 0 && <span>{details.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === "document"}
          onClick={() => setTab("document")}
        >
          Document
        </button>
        {items.length > 0 && (
          <button
            className="clear-inspection"
            aria-label="Clear selection"
            onClick={() => {
              setItems([]);
              onPreview([]);
              onFocus([]);
            }}
          >
            ×
          </button>
        )}
      </div>
      {tab === "selection" && (
        <div className="selection-pages" aria-label="Selection sections">
          {["overview", "relationships", "evidence", "questions"].map(
            (value) => (
              <button
                key={value}
                className={page === value ? "active" : ""}
                aria-pressed={page === value}
                onClick={() => setPage(value)}
              >
                {value === "relationships"
                  ? "Relations"
                  : value[0].toUpperCase() + value.slice(1)}
              </button>
            ),
          )}
        </div>
      )}
      <div className="inspector-scroll">
        {!doc ? (
          <p className="muted">
            {busy ? "Loading…" : "Choose an explanation."}
          </p>
        ) : tab === "document" ? (
          <>
            <h2>{doc.title}</h2>
            <p className="body-text">{doc.description}</p>
            <h3>Source</h3>
            <dl className="document-facts">
              <dt>Repository</dt>
              <dd>{doc.provenance.repository}</dd>
              <dt>Revision</dt>
              <dd>
                <code>{doc.provenance.revision}</code>
              </dd>
              <dt>Inspected</dt>
              <dd>{new Date(doc.provenance.inspectedAt).toLocaleString()}</dd>
              <dt>Method</dt>
              <dd>{doc.provenance.method}</dd>
            </dl>
            <h3>Limits & unknowns</h3>
            <p>{doc.provenance.limitations}</p>
            <button onClick={exportMap}>Export explanation JSON</button>
          </>
        ) : page === "questions" ? (
          <>
            <h2>{node ? "Questions about " + node.title : "Map questions"}</h2>
            {notes.map((question) => (
              <article className="note" key={question.id}>
                <strong>{question.author}</strong>
                <small>
                  r{question.atRevision}
                  {question.nodeId ? " · " + question.nodeId : ""}
                </small>
                <p>{question.text}</p>
              </article>
            ))}
            <label className="note-label">
              Question
              <textarea
                aria-label="Your question"
                placeholder="What should we clarify?"
                readOnly={old || record.deleted || busy}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={!note.trim() || old || record.deleted || busy}
              onClick={saveNote}
            >
              Save question
            </button>
            {old && (
              <p className="muted">
                Switch to the latest revision to save. This draft stays here.
              </p>
            )}
          </>
        ) : !details.length ? (
          <p className="muted">
            Select a node, connection or connection point.
          </p>
        ) : (
          <>
            <div className="selection-identity">
              <span className="node-icon">
                {node ? node.kind.slice(0, 1).toUpperCase() : edge ? "↗" : "◇"}
              </span>
              <div>
                <h2>
                  {node?.title ?? edge?.label ?? details.length + " selected"}
                </h2>
                <span>
                  {node?.kind ??
                    (edge
                      ? "Connection"
                      : `${nodeIds.size} ${nodeIds.size === 1 ? "node" : "nodes"} · ${edgeIds.size} ${edgeIds.size === 1 ? "connection" : "connections"}`)}
                </span>
              </div>
            </div>
            {page === "overview" ? (
              <>
                {node ? (
                  <p className="body-text">{node.body}</p>
                ) : edge ? (
                  <>
                    <p className="relationship-story">
                      {name(edge.source)} <span>→ {edge.label} →</span>{" "}
                      {name(edge.target)}
                    </p>
                    <p className="body-text">{edge.body}</p>
                  </>
                ) : (
                  <>
                    <p>
                      {related.length}{" "}
                      {related.length === 1
                        ? "relationship connects"
                        : "relationships connect"}{" "}
                      this selection with its context.
                    </p>
                    <div className="selection-members">
                      {memberRows.map((item) => (
                        <div key={item.id}>
                          <button
                            onClick={(event) =>
                              setItems((previous) =>
                                selectFromEvent(previous, item.items, event),
                              )
                            }
                          >
                            <span>{item.icon}</span>
                            {item.label}
                            {item.items.length > 1
                              ? " · " + item.items.length
                              : " "}
                          </button>
                          <button
                            aria-label={`Remove ${item.label} from selection`}
                            onClick={() =>
                              setItems((previous) =>
                                previous.filter(
                                  (chosen) =>
                                    !item.items.some(
                                      (member) =>
                                        member.type === chosen.type &&
                                        member.id === chosen.id,
                                    ),
                                ),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {(node || edge) && (
                  <span className={"badge " + (node ?? edge).evidence}>
                    {labels[(node ?? edge).evidence]}
                  </span>
                )}
              </>
            ) : page === "relationships" ? (
              <>
                {!related.length && (
                  <p className="muted">No authored connections.</p>
                )}
                {related.map((group) => {
                  const chosen = group.members.filter((id) =>
                    edgeIds.has(id),
                  ).length;
                  return (
                    <div
                      className={
                        "relationship-item " + (chosen ? "explicit" : "")
                      }
                      key={group.edge.id}
                    >
                      <button
                        className="relation"
                        onPointerEnter={() => onPreview(group.members)}
                        onPointerLeave={() => onPreview([])}
                        onFocus={() => onFocus(group.members)}
                        onBlur={() => onFocus([])}
                        onClick={(event) => onSelectEdges(group.members, event)}
                        aria-pressed={
                          chosen === group.members.length
                            ? true
                            : chosen
                              ? "mixed"
                              : false
                        }
                      >
                        <span>
                          {chosen ? "Selected connection" : "Related"}
                          {group.members.length > 1
                            ? " · " + group.members.length + " records"
                            : ""}
                        </span>
                        <strong>
                          {name(group.edge.source)}{" "}
                          <i>→ {group.edge.label} →</i>{" "}
                          {name(group.edge.target)}
                        </strong>
                      </button>
                      <p>{group.edge.body}</p>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {details.map((item) => {
                  const object =
                    item.type === "node"
                      ? doc.nodes.find((node) => node.id === item.id)
                      : doc.edges.find((edge) => edge.id === item.id);
                  return (
                    <section
                      key={JSON.stringify(item)}
                      className="evidence-item"
                    >
                      <h3>{item.label}</h3>
                      <span className={"badge " + object.evidence}>
                        {labels[object.evidence]}
                      </span>
                      <code className="code-id">{item.id}</code>
                      {details.length > 1 && (
                        <button
                          className="technical-remove"
                          aria-label={`Remove ${item.id} from selection`}
                          onClick={() =>
                            setItems((previous) =>
                              previous.filter(
                                (chosen) =>
                                  chosen.type !== item.type ||
                                  chosen.id !== item.id,
                              ),
                            )
                          }
                        >
                          Remove from selection
                        </button>
                      )}
                      {item.type === "edge" ? (
                        <p>
                          Relationship role:{" "}
                          {relations[object.role ?? "reference"].label}
                        </p>
                      ) : object.sources.length ? (
                        object.sources.map((source, index) => (
                          <div className="reference" key={index}>
                            <code>
                              {source.file}
                              {source.line ? ":" + source.line : ""}
                            </code>
                            {source.symbol && <strong>{source.symbol}</strong>}
                            {source.note && <p>{source.note}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="muted">No source citation supplied.</p>
                      )}
                    </section>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
      <div className="revision-panel">
        <label>
          Revision
          <select
            aria-label="Saved revision"
            value={record?.revision ?? ""}
            disabled={busy || !record}
            onChange={(event) => load(mapId, Number(event.target.value))}
          >
            {[...history].reverse().map((version) => (
              <option key={version.revision} value={version.revision}>
                r{version.revision}
                {version.revision === history.at(-1)?.revision
                  ? " · Latest"
                  : ""}{" "}
                · {version.author}
                {version.deleted ? " · Archived" : ""}
              </option>
            ))}
          </select>
        </label>
        <p title={record?.createdAt}>{record?.summary}</p>
      </div>
    </aside>
  );
}
