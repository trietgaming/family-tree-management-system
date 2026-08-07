import type { FamilyModel, Union } from "../model";

export type Side = "top" | "bottom" | "left" | "right" | "left-in" | "right-in";

export type LayoutNode = {
  id: string;
  kind: "person" | "union";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
  /** Which side of each node the line leaves and arrives on. */
  sourceHandle: Side;
  targetHandle: Side;
  kind: "partner" | "child";
  /** The height of the horizontal run. Absent means draw a straight line. */
  busY?: number;
  /** Where the line starts, when the handle is not where the ink should begin. */
  startY?: number;
  /** Marriage lines only: both partners named each other, rather than merely sharing a child. */
  declared?: boolean;
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
};

export type Layout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  junctions: Junction[];
  generations: Map<string, number>;
};

/**
 * One marriage of the person a node is built around: the spouse drawn beside
 * them when nobody else has claimed that spouse yet, and the children whose
 * own descendants hang below here.
 */
export type Branch = {
  union: Union;
  spouseId: string | null;
  children: TreeNode[];
};

/**
 * A person and everything descending from them. Each person appears in exactly
 * one node, which is what makes the horizontal placement a plain tree walk
 * with no constraints to reconcile afterwards.
 */
export type TreeNode = {
  personId: string;
  branches: Branch[];
  /** The cards on this node's own row, left to right. */
  row: string[];
  width: number;
};

/**
 * What every stage after the first two needs to know: who is related to whom,
 * which row each person is on, and where along it they ended up. Passed as one
 * value because passing three was three chances to pass the wrong one.
 */
export type Frame = {
  model: FamilyModel;
  generations: Map<string, number>;
  centres: Map<string, number>;
};
