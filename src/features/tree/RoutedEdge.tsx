import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import type { Point } from "../../family/layout";

export type RoutedEdgeType = Edge<{ points: Point[]; people: string[] }, "routed">;

/**
 * Draws the line the router worked out, and nothing else.
 *
 * The geometry used to live here as well as in the code that finds the dots,
 * which meant two descriptions of the same path and no way to tell when they
 * had drifted apart. Now there is one, and this joins up its points.
 */
export function RoutedEdge({ id, data, style }: EdgeProps<RoutedEdgeType>) {
  const points = data?.points ?? [];
  if (points.length < 2) return null;

  const path = points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x},${y}`).join(" ");

  return <BaseEdge id={id} path={path} style={style} />;
}
