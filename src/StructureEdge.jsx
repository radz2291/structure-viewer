import React, { memo } from "react";
import { BaseEdge, getSmoothStepPath, Position } from "@xyflow/react";
import { feedbackRoute } from "../lib/canvas-model.mjs";
function StructureEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}) {
  const path =
    sourceX >= targetX - 32
      ? feedbackRoute(
          { x: sourceX, y: sourceY },
          { x: targetX, y: targetY },
          data.cards,
        )
      : getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          borderRadius: 7,
        })[0];
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={20}
    />
  );
}
export default memo(StructureEdge);
