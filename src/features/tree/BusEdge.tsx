import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";

export type BusEdgeType = Edge<{ busY?: number; startY?: number }, "bus">;

/**
 * Down, across, down — square corners, and the height of the horizontal run
 * decided by the layout rather than by the two endpoints.
 *
 * That last part is the point of writing this instead of using the built-in
 * step edge: every child of one union is given the same height, so the runs
 * lie on top of one another and read as a single bar, and a union whose bar
 * would cross somebody else's is handed a different one.
 */
export function BusEdge({ id, sourceX, sourceY, targetX, targetY, data, style }: EdgeProps<BusEdgeType>) {
  // A handle sits a little outside the node it belongs to, which would leave a
  // gap where this line meets the marriage line. The layout says where the ink
  // should actually begin.
  const startY = data?.startY ?? sourceY;
  const busY = data?.busY ?? (startY + targetY) / 2;
  const path = `M ${sourceX},${startY} L ${sourceX},${busY} L ${targetX},${busY} L ${targetX},${targetY}`;

  return <BaseEdge id={id} path={path} style={style} />;
}
