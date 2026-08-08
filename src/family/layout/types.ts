export type LayoutNode = {
  id: string;
  kind: "person" | "union";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = { x: number; y: number };

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
  kind: "marriage" | "child";
  /** Marriage lines only: both partners named each other. */
  declared?: boolean;
  /**
   * Everyone this line joins. `source` and `target` do not say: either can be
   * a union, which is a joint rather than a person.
   */
  people: string[];
  /** The line itself. The only description of it there is. */
  points: Point[];
};

/**
 * A place where lines genuinely meet, as opposed to one merely passing over
 * another. Marked, so that a crossing left unmarked can be read as a crossing.
 */
export type Junction = {
  id: string;
  x: number;
  y: number;
  on: "marriage" | "descent";
  /** Everyone whose lines meet here. */
  people: string[];
};

export type Layout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  junctions: Junction[];
  generations: Map<string, number>;
};

