import type { Edge, Node } from "@xyflow/react";
import { layout } from "../../family/layout";
import { buildModel } from "../../family/model";
import type { Family } from "../../family/schema";
import { DASH, DESCENT, DOT, MARRIAGE } from "./palette";

/**
 * The layout decides everything; this only says it in React Flow's words.
 * Keeping the translation out of the component is what lets the layout be
 * checked without a browser.
 */
export function toFlow(family: Family | null): { nodes: Node[]; edges: Edge[] } {
  if (!family) return { nodes: [], edges: [] };

  const model = buildModel(family);
  const drawn = layout(model);

  const nodes: Node[] = drawn.nodes.map((node) => ({
    id: node.id,
    type: node.kind,
    position: { x: node.x, y: node.y },
    // Given rather than measured: the layout already decided these, and React
    // Flow needs them before it can route an edge.
    width: node.width,
    height: node.height,
    // Positions come from the layout, so dragging one would only lie about it.
    draggable: false,
    data:
      node.kind === "person"
        ? {
            name: model.byId.get(node.id)?.name ?? node.id,
            birthYear: model.byId.get(node.id)?.birthYear,
            gender: model.byId.get(node.id)?.gender,
          }
        : {},
  }));

  // Added after the people so they sit on top of the lines rather than under.
  nodes.push(
    ...drawn.junctions.map((junction) => ({
      id: junction.id,
      type: "junction",
      position: { x: junction.x - DOT / 2, y: junction.y - DOT / 2 },
      width: DOT,
      height: DOT,
      draggable: false,
      selectable: false,
      focusable: false,
      data: { on: junction.on, people: junction.people },
    })),
  );

  const edges: Edge[] = drawn.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "routed",
    data: { points: edge.points, people: edge.people },
    // Dashed where the union was only inferred from a shared child, which is
    // the long-standing way of saying "together" without saying "married".
    style:
      edge.kind === "child"
        ? { stroke: DESCENT, strokeWidth: 1.5 }
        : {
            stroke: MARRIAGE,
            strokeWidth: 2,
            strokeDasharray: edge.declared ? undefined : DASH,
          },
  }));

  return { nodes, edges };
}
