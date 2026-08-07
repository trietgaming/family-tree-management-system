import type { Union } from "../model";
import { PERSON_HEIGHT, PERSON_WIDTH, UNION_SIZE, rowY } from "./geometry";
import { junctionsFor } from "./junctions";
import { sideBySide } from "./lines";
import type { Frame, Junction, Layout, LayoutEdge, LayoutNode } from "./types";

export type Heights = {
  joints: Map<string, number>;
  buses: Map<string, number>;
  marriages: Map<string, number>;
};

/** Both partners named each other, rather than merely sharing a child. */
function isDeclared(union: Union, { model }: Frame): boolean {
  return (
    union.partnerIds.length === 2 &&
    union.partnerIds.every((id, index) =>
      (model.byId.get(id)?.spouseIds ?? []).includes(union.partnerIds[1 - index]),
    )
  );
}

function cards(frame: Frame): LayoutNode[] {
  return frame.model.order.map((person) => ({
    id: person.id,
    kind: "person",
    x: (frame.centres.get(person.id) ?? 0) - PERSON_WIDTH / 2,
    y: rowY(frame.generations.get(person.id) ?? 0),
    width: PERSON_WIDTH,
    height: PERSON_HEIGHT,
  }));
}

/**
 * The joint, the lines out of it, and the dots where they meet — everything
 * one union contributes to the drawing.
 */
function partsOf(
  union: Union,
  frame: Frame,
  heights: Heights,
): { node: LayoutNode; edges: LayoutEdge[]; junctions: Junction[] } {
  const row = Math.max(...union.partnerIds.map((id) => frame.generations.get(id) ?? 0));
  const top = rowY(row);

  const couple = union.partnerIds.length === 2;
  const together = sideBySide(union, frame);
  const declared = isDeclared(union, frame);
  const jointX = heights.joints.get(union.id) ?? 0;

  /**
   * Where this marriage's line runs, and so where the drop to the children
   * begins. Side by side, it is the line between the two cards. Otherwise — a
   * third marriage, or a spouse who lives in another family's block — it runs
   * below the row, on a height of its own, because a line at card height would
   * disappear behind whoever is standing in between.
   */
  const lineY = together
    ? top + PERSON_HEIGHT / 2
    : (heights.marriages.get(union.id) ?? top + PERSON_HEIGHT);

  const edges: LayoutEdge[] = [];

  if (together) {
    // One line from card to card. Two lines meeting at the joint would leave a
    // gap there, because a handle sits slightly outside the node it is on.
    const [left, right] = [...union.partnerIds].sort(
      (a, b) => (frame.centres.get(a) ?? 0) - (frame.centres.get(b) ?? 0),
    );

    edges.push({
      id: `${left}~${right}`,
      source: left,
      target: right,
      sourceHandle: "right",
      targetHandle: "left-in",
      kind: "partner",
      declared,
    });
  } else if (couple) {
    for (const partnerId of union.partnerIds) {
      edges.push({
        id: `${partnerId}->${union.id}`,
        source: partnerId,
        target: union.id,
        sourceHandle: "bottom",
        targetHandle: "top",
        declared,
        kind: "partner",
        busY: lineY,
      });
    }
  }

  for (const childId of union.childIds) {
    edges.push({
      id: `${union.id}->${childId}`,
      source: union.id,
      target: childId,
      sourceHandle: "bottom",
      targetHandle: "top",
      kind: "child",
      busY: heights.buses.get(union.id),
      startY: lineY,
    });
  }

  return {
    node: {
      id: union.id,
      kind: "union",
      x: jointX - UNION_SIZE / 2,
      y: lineY - UNION_SIZE / 2,
      width: UNION_SIZE,
      height: UNION_SIZE,
    },
    edges,
    junctions: junctionsFor(
      union,
      jointX,
      lineY,
      heights.buses.get(union.id),
      union.childIds.map((id) => frame.centres.get(id) ?? 0),
      couple,
    ),
  };
}

export function assemble(frame: Frame, heights: Heights): Layout {
  const nodes = cards(frame);
  const edges: LayoutEdge[] = [];
  const junctions: Junction[] = [];

  for (const union of frame.model.unions) {
    const parts = partsOf(union, frame, heights);

    nodes.push(parts.node);
    edges.push(...parts.edges);
    junctions.push(...parts.junctions);
  }

  // Everything moves together, or the dots come away from their lines.
  const left = nodes.length === 0 ? 0 : Math.min(...nodes.map((node) => node.x));

  return {
    nodes: nodes.map((node) => ({ ...node, x: node.x - left })),
    edges,
    junctions: junctions.map((each) => ({ ...each, x: each.x - left })),
    generations: frame.generations,
  };
}
