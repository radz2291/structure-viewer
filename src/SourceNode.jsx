import React, { memo, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { relations, labels } from "./presentation.js";
function SourceNode({ id, data, selected }) {
  const update = useUpdateNodeInternals();
  const signature = data.ports.map((port) => port.id).join("|");
  useEffect(() => {
    update(id);
  }, [id, signature, update]);
  return (
    <div
      className={`source-node ${selected ? "chosen" : ""} ${data.dim ? "dim" : ""} ${data.traced ? "traced" : ""}`}
      data-geometry={data.geometryKey}
    >
      <header>
        <span className="node-icon">{data.kind.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{data.title}</strong>
          <span className="kind">{data.kind}</span>
        </div>
        <span
          className={`dot ${data.evidence}`}
          title={labels[data.evidence]}
        />
      </header>
      <p>{data.summary}</p>
      {data.ports.length > 0 && (
        <div
          className="node-connections"
          aria-label={`Connections for ${data.title}`}
        >
          {["in", "out"].map((side) => (
            <div
              key={side}
              className={`connection-side ${side}`}
              aria-label={
                side === "in" ? "Incoming connections" : "Outgoing connections"
              }
            >
              {data.ports
                .filter((port) => port.side === side)
                .map((port) => {
                  const chosen = port.edges.filter((edge) =>
                      data.selectedEdges.has(edge),
                    ).length,
                    traced = port.edges.some((edge) =>
                      data.tracedEdges.has(edge),
                    );
                  return (
                    <div
                      key={port.id}
                      className={`connection-row ${traced ? "previewed" : ""}`}
                      style={{ "--relation-color": relations[port.role].color }}
                    >
                      <button
                        type="button"
                        className="port-control nodrag nopan"
                        aria-label={`${side === "in" ? "Incoming" : "Outgoing"} ${port.label} connections for ${data.title}`}
                        aria-pressed={
                          chosen === port.edges.length
                            ? true
                            : chosen
                              ? "mixed"
                              : false
                        }
                        title={`${port.label} · ${port.edges.length} ${port.edges.length === 1 ? "connection" : "connections"}${chosen ? "; " + chosen + " selected" : ""}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerEnter={() => data.onHover(port.edges)}
                        onPointerLeave={() => data.onHover([])}
                        onFocus={() => data.onFocus(port.edges)}
                        onBlur={() => data.onFocus([])}
                        onClick={(event) => {
                          event.stopPropagation();
                          data.onPortSelect(port.edges, event);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Escape") event.stopPropagation();
                        }}
                      >
                        <span className="port-dot" aria-hidden="true" />
                        <span className="port-label">{port.label}</span>
                        {port.edges.length > 1 && (
                          <span className="port-count">
                            {chosen && chosen < port.edges.length
                              ? chosen + "/"
                              : ""}
                            {port.edges.length}
                          </span>
                        )}
                      </button>
                      <Handle
                        id={port.id}
                        type={side === "out" ? "source" : "target"}
                        position={
                          side === "out" ? Position.Right : Position.Left
                        }
                        isConnectable={false}
                        isConnectableStart={false}
                        isConnectableEnd={false}
                        style={{ background: relations[port.role].color }}
                      />
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default memo(SourceNode);
