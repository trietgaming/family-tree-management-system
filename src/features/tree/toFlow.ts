import type { Edge, Node } from "@xyflow/react";
import { layout } from "../../family/layout";
import type { Person, PersonRepository } from "../../family/model";
import { DASH, DESCENT, DOT, MARRIAGE } from "./palette";

/**
 * The layout decides everything; this only says it in React Flow's words.
 * Keeping the translation out of the component is what lets the layout be
 * checked without a browser.
 *
 * This is also where people turn back into ids. React Flow keys everything by
 * string, so the boundary has to be somewhere, and here is as late as it gets.
 */
export function toFlow(repo: PersonRepository | null): { nodes: Node[]; edges: Edge[] } {
  if (!repo) return { nodes: [], edges: [] };

  const drawn = layout(repo);

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
    data: node.person === null ? {} : personDataOf(node.person),
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
      data: { on: junction.on, people: idsOf(junction.people) },
    })),
  );

  const edges: Edge[] = drawn.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "routed",
    data: { points: edge.points, people: idsOf(edge.people), kind: edge.kind },
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

function personDataOf(person: Person) {
  return { name: person.name, birthYear: person.birthYear, gender: person.gender };
}

function idsOf(people: Person[]): string[] {
  return people.map((person) => person.id.value);
}
