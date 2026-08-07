import { ancestorsOf, parentIdsOf, type FamilyModel, type Union } from "./model";

export const PERSON_WIDTH = 176;
export const PERSON_HEIGHT = 68;
/**
 * Barely there on purpose. The joint is a routing point, not a mark: any width
 * here becomes a gap in the line between two spouses, which reads as a dash.
 */
export const UNION_SIZE = 2;

const PARTNER_GAP = 28;
const SIBLING_GAP = 56;
const TREE_GAP = 112;
const ROW_GAP = 96;

/** How far above the children's row the lowest bar sits, and the step between lanes. */
const BUS_CLEARANCE = 30;
const LANE_STEP = 18;

/** How far below the row a marriage runs when the pair cannot sit side by side. */
const MARRIAGE_DROP = 18;

const CARD_STEP = PERSON_WIDTH + PARTNER_GAP;

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

export type Side = "top" | "bottom" | "left" | "right" | "left-in" | "right-in";

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
type Branch = {
  union: Union;
  spouseId: string | null;
  children: TreeNode[];
};

/**
 * A person and everything descending from them. Each person appears in exactly
 * one node, which is what makes the horizontal placement a plain tree walk
 * with no constraints to reconcile afterwards.
 */
type TreeNode = {
  personId: string;
  branches: Branch[];
  /** The cards on this node's own row, left to right. */
  row: string[];
  width: number;
};

export function layout(model: FamilyModel): Layout {
  const generations = assignGenerations(model);
  const forest = buildForest(model);
  const centres = new Map<string, number>();

  let cursor = 0;
  for (const tree of forest) {
    const laid = arrange(tree, centres);
    shiftSubtree(tree, cursor, centres);
    cursor += laid.width + TREE_GAP;
  }

  return toLayout(model, generations, centres);
}

/**
 * A child sits one row below its parents, and partners share a row. Both rules
 * only ever push a row downwards, so repeating them settles rather than
 * oscillates. Cycles are refused by validation before this runs.
 *
 * The rows are worked out separately from the columns because a spouse who
 * married in from another lineage has to line up with their partner, not with
 * their depth inside their own tree.
 */
function assignGenerations(model: FamilyModel): Map<string, number> {
  const generations = new Map(model.order.map((person) => [person.id, 0]));
  const at = (id: string) => generations.get(id) ?? 0;

  /**
   * A union between an ancestor and a descendant cannot have it both ways: one
   * of them is below the other by birth, and levelling them would then push
   * that same descendant down again, and again, until the pass limit stops it
   * on a number that means nothing. Descent wins; the marriage is drawn as a
   * link between two rows instead.
   */
  const acrossGenerations = new Set(
    model.unions
      .filter((union) => {
        if (union.partnerIds.length !== 2) return false;

        const [a, b] = union.partnerIds;

        return ancestorsOf(model, a).has(b) || ancestorsOf(model, b).has(a);
      })
      .map((union) => union.id),
  );

  for (let pass = 0; pass <= model.order.length; pass++) {
    let moved = false;

    for (const person of model.order) {
      const parents = parentIdsOf(model, person.id);
      if (parents.length === 0) continue;

      const wanted = Math.max(...parents.map(at)) + 1;
      if (wanted > at(person.id)) {
        generations.set(person.id, wanted);
        moved = true;
      }
    }

    for (const union of model.unions) {
      if (acrossGenerations.has(union.id)) continue;

      const wanted = Math.max(...union.partnerIds.map(at));

      for (const partnerId of union.partnerIds) {
        if (wanted > at(partnerId)) {
          generations.set(partnerId, wanted);
          moved = true;
        }
      }
    }

    if (!moved) break;
  }

  return generations;
}

/**
 * Turns the graph into trees by giving every person one home: the first place
 * the walk reaches them. A spouse nobody has claimed is drawn beside their
 * partner, which keeps couples together even when they come from different
 * families — the price is that the link up to their own parents is a long one.
 * That is the trade this layout makes, and it is the reason each joint can sit
 * exactly above its own children.
 */
function buildForest(model: FamilyModel): TreeNode[] {
  const placed = new Set<string>();
  const documentOrder = new Map(model.order.map((person, index) => [person.id, index]));

  /**
   * A person with one spouse keeps the order the document gives them; a person
   * with several stands in the middle, so every joint has a partner beside it.
   */
  const rowFor = (personId: string, branches: Branch[]): string[] => {
    const spouses = branches
      .map((branch) => branch.spouseId)
      .filter((id): id is string => id !== null);

    if (spouses.length === 0) return [personId];

    if (spouses.length === 1) {
      const [spouse] = spouses;

      return (documentOrder.get(personId) ?? 0) <= (documentOrder.get(spouse) ?? 0)
        ? [personId, spouse]
        : [spouse, personId];
    }

    return [spouses[0], personId, ...spouses.slice(1)];
  };

  const build = (personId: string): TreeNode => {
    placed.add(personId);

    const branches: Branch[] = [];
    const household = [personId];
    const seen = new Set<string>();

    // A spouse brings their own other marriages into this node with them.
    for (let i = 0; i < household.length; i++) {
      for (const union of model.unionsOf.get(household[i]) ?? []) {
        if (seen.has(union.id)) continue;
        seen.add(union.id);

        const other = union.partnerIds.find((id) => id !== household[i]);
        const spouseId = other !== undefined && !placed.has(other) ? other : null;

        if (spouseId !== null) {
          placed.add(spouseId);
          household.push(spouseId);
        }

        // Claim the children before recursing, so a sibling cannot be pulled
        // away and drawn as somebody's spouse instead.
        const mine = union.childIds.filter((id) => !placed.has(id));
        for (const id of mine) placed.add(id);

        branches.push({ union, spouseId, children: mine.map(build) });
      }
    }

    return { personId, branches, row: [], width: 0 };
  };

  const roots: TreeNode[] = [];

  for (const person of model.order) {
    if (placed.has(person.id) || model.bornInto.has(person.id)) continue;
    roots.push(build(person.id));
  }

  // Anything still unplaced is disconnected from every root; give it its own.
  for (const person of model.order) {
    if (!placed.has(person.id)) roots.push(build(person.id));
  }

  orderBranches(roots, model);

  for (const root of roots) {
    const fill = (node: TreeNode) => {
      node.row = rowFor(node.personId, node.branches);
      childrenOf(node).forEach(fill);
    };
    fill(root);
  }

  return roots;
}

function allNodes(node: TreeNode): TreeNode[] {
  return [node, ...childrenOf(node).flatMap(allNodes)];
}

function peopleIn(node: TreeNode): string[] {
  return allNodes(node).flatMap((each) => [
    each.personId,
    ...each.branches.map((branch) => branch.spouseId).filter((id): id is string => id !== null),
  ]);
}

/**
 * Which way a branch leans, and the order that follows from it.
 *
 * A spouse drawn beside their partner keeps their own parents in whichever
 * tree those parents belong to, so the line up to them has to cross. It is at
 * its shortest when that spouse sits on the side facing the family they came
 * from — which is what sorting by lean arranges. Without it, a married-in
 * daughter can end up at the far end of her husband's family and her parents'
 * line has to reach across the whole drawing.
 */
function orderBranches(roots: TreeNode[], model: FamilyModel): void {
  const homeTree = new Map<string, number>();
  roots.forEach((root, index) => {
    for (const id of peopleIn(root)) homeTree.set(id, index);
  });

  const leanOf = (node: TreeNode, home: number): number => {
    const elsewhere = peopleIn(node)
      .flatMap((id) => parentIdsOf(model, id))
      .map((parentId) => homeTree.get(parentId))
      .filter((index): index is number => index !== undefined && index !== home);

    const average = mean(elsewhere);

    return average === null ? 0 : average - home;
  };

  roots.forEach((root, home) => {
    for (const node of allNodes(root)) {
      const lean = new Map(
        node.branches.map((branch) => [
          branch,
          mean(branch.children.map((child) => leanOf(child, home))) ?? 0,
        ]),
      );

      node.branches.sort((a, b) => (lean.get(a) ?? 0) - (lean.get(b) ?? 0));
    }
  });
}

function childrenOf(node: TreeNode): TreeNode[] {
  return node.branches.flatMap((branch) => branch.children);
}

/**
 * Card positions for one row, given where some of the gaps between them would
 * like their joint to be.
 *
 * A joint sits midway between two cards, so asking it to land over a particular
 * point fixes the second card once the first is placed — which is why this
 * walks left to right rather than solving anything. Spouses are pushed apart
 * when that is what it takes; they never come closer than a full card and gap,
 * and a joint that would need them nearer keeps the minimum and gives up a
 * little accuracy instead.
 */
function placeRow(row: string[], wanted: Map<number, number>): number[] {
  const first = wanted.get(0);
  const cards = [first === undefined ? PERSON_WIDTH / 2 : first - CARD_STEP / 2];

  for (let i = 1; i < row.length; i++) {
    const joint = wanted.get(i - 1);

    cards.push(
      joint === undefined
        ? cards[i - 1] + CARD_STEP
        : Math.max(cards[i - 1] + CARD_STEP, 2 * joint - cards[i - 1]),
    );
  }

  return cards;
}

function shiftSubtree(node: TreeNode, by: number, centres: Map<string, number>): void {
  for (const id of peopleIn(node)) centres.set(id, (centres.get(id) ?? 0) + by);
}

/**
 * Lays a subtree out in its own coordinates and reports how wide it came out
 * and where its own card ended up.
 *
 * The anchor is the point of it. Centring a child block under the middle of
 * its own width lines the parents up with the gap between the child and the
 * child's spouse, not with the child — so a line to an only child leaves the
 * joint, jogs sideways, and comes back down for no reason. Aligning anchors
 * instead puts the child directly beneath, and the jog disappears.
 */
function arrange(node: TreeNode, centres: Map<string, number>): { width: number; anchor: number } {

  let cursor = 0;
  const wanted = new Map<number, number>();

  for (const branch of node.branches) {
    const anchors: number[] = [];

    for (const child of branch.children) {
      const laid = arrange(child, centres);
      shiftSubtree(child, cursor, centres);
      anchors.push(cursor + laid.anchor);
      cursor += laid.width + SIBLING_GAP;
    }

    if (anchors.length === 0) continue;

    // Only a gap between two neighbouring cards can be widened to suit; a
    // marriage that already runs below the row is not held to this.
    const pair = branch.union.partnerIds
      .map((id) => node.row.indexOf(id))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);

    const middle = (Math.min(...anchors) + Math.max(...anchors)) / 2;

    if (pair.length === 2 && pair[1] === pair[0] + 1) wanted.set(pair[0], middle);
    else if (pair.length === 1) wanted.set(-1, middle - pair[0] * CARD_STEP - PERSON_WIDTH / 2);
  }

  const childrenRight = Math.max(0, cursor - SIBLING_GAP);
  const cards = placeRow(node.row, wanted);

  // A lone parent has no gap to widen, so the whole row slides instead.
  const slide = wanted.get(-1) ?? 0;
  node.row.forEach((id, index) => centres.set(id, cards[index] + slide));

  const from = Math.min(0, cards[0] + slide - PERSON_WIDTH / 2);
  const to = Math.max(childrenRight, cards[cards.length - 1] + slide + PERSON_WIDTH / 2);

  if (from !== 0) {
    for (const child of childrenOf(node)) shiftSubtree(child, -from, centres);
    for (const id of node.row) centres.set(id, (centres.get(id) ?? 0) - from);
  }

  node.width = to - from;

  return { width: node.width, anchor: centres.get(node.personId) ?? 0 };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * The height of each union's horizontal bar.
 *
 * Every bar wants to sit just above the children it feeds, but two bars at the
 * same height that overlap horizontally merge into one line, and the drawing
 * then claims a relationship that is not there. Bars that cross are given
 * separate lanes — narrowest first, so the local ones stay low and a bar
 * reaching across the drawing rides above them.
 */
function assignBuses(
  model: FamilyModel,
  generations: Map<string, number>,
  centres: Map<string, number>,
  joints: Map<string, number>,
  rowY: (row: number) => number,
): Map<string, number> {
  const buses = new Map<string, number>();
  const byRow = new Map<number, Union[]>();

  for (const union of model.unions) {
    if (union.childIds.length === 0) continue;

    const row = Math.max(...union.partnerIds.map((id) => generations.get(id) ?? 0));
    byRow.set(row, [...(byRow.get(row) ?? []), union]);
  }

  for (const [row, unions] of byRow) {
    const spans = unions
      .map((union) => {
        const xs = [joints.get(union.id) ?? 0, ...union.childIds.map((id) => centres.get(id) ?? 0)];

        return { union, left: Math.min(...xs), right: Math.max(...xs) };
      })
      .sort((a, b) => a.right - a.left - (b.right - b.left));

    const occupied: { left: number; right: number }[][] = [];

    for (const span of spans) {
      let lane = 0;
      while (
        occupied[lane]?.some((taken) => span.left < taken.right && taken.left < span.right)
      ) {
        lane++;
      }

      occupied[lane] = [...(occupied[lane] ?? []), span];
      buses.set(span.union.id, rowY(row + 1) - BUS_CLEARANCE - lane * LANE_STEP);
    }
  }

  return buses;
}

/** True when the two can stand next to each other with the line between them. */
function sideBySide(
  union: Union,
  generations: Map<string, number>,
  centres: Map<string, number>,
): boolean {
  if (union.partnerIds.length !== 2) return false;

  const rows = union.partnerIds.map((id) => generations.get(id) ?? 0);
  if (rows[0] !== rows[1]) return false;

  const seats = union.partnerIds.map((id) => centres.get(id) ?? 0);

  return Math.abs(seats[0] - seats[1]) <= PERSON_WIDTH + PARTNER_GAP + 2;
}

/**
 * Heights for the marriages that have to run below the row.
 *
 * Somebody married three times gets a line for each, all leaving the same card
 * and heading the same way — at one height they lie on top of one another and
 * there is no telling which wife is which. Overlapping lines are given
 * separate heights, the same way the bars down to children are.
 */
function assignMarriageLanes(
  model: FamilyModel,
  generations: Map<string, number>,
  centres: Map<string, number>,
  rowY: (row: number) => number,
): Map<string, number> {
  const byRow = new Map<number, { union: Union; left: number; right: number }[]>();

  for (const union of model.unions) {
    if (union.partnerIds.length !== 2 || sideBySide(union, generations, centres)) continue;

    const seats = union.partnerIds.map((id) => centres.get(id) ?? 0);
    const row = Math.max(...union.partnerIds.map((id) => generations.get(id) ?? 0));

    byRow.set(row, [
      ...(byRow.get(row) ?? []),
      { union, left: Math.min(...seats), right: Math.max(...seats) },
    ]);
  }

  const lanes = new Map<string, number>();

  for (const [row, spans] of byRow) {
    // Room between the foot of this row and the highest bar down to children.
    const headroom = rowY(row + 1) - BUS_CLEARANCE - LANE_STEP - (rowY(row) + PERSON_HEIGHT + MARRIAGE_DROP);
    const most = Math.max(0, Math.floor(headroom / LANE_STEP));

    const occupied: { left: number; right: number }[][] = [];

    for (const span of [...spans].sort((a, b) => a.right - a.left - (b.right - b.left))) {
      let lane = 0;
      while (lane < most && occupied[lane]?.some((t) => span.left < t.right && t.left < span.right)) {
        lane++;
      }

      occupied[lane] = [...(occupied[lane] ?? []), span];
      lanes.set(span.union.id, rowY(row) + PERSON_HEIGHT + MARRIAGE_DROP + lane * LANE_STEP);
    }
  }

  return lanes;
}

function toLayout(
  model: FamilyModel,
  generations: Map<string, number>,
  centres: Map<string, number>,
): Layout {
  const rowY = (row: number) => row * (PERSON_HEIGHT + ROW_GAP);
  const marriages = assignMarriageLanes(model, generations, centres, rowY);

  const nodes: LayoutNode[] = model.order.map((person) => ({
    id: person.id,
    kind: "person",
    x: (centres.get(person.id) ?? 0) - PERSON_WIDTH / 2,
    y: rowY(generations.get(person.id) ?? 0),
    width: PERSON_WIDTH,
    height: PERSON_HEIGHT,
  }));

  /**
   * Where along its own line each marriage hands over to its children.
   *
   * Two people standing together have one sensible point, the gap between
   * them. A marriage drawn below the row is already a horizontal run from one
   * card to the other, so the handover can be anywhere along it — and directly
   * above the children is the place that costs no sideways jog. Only when the
   * children lie outside the run does it settle for the nearest end.
   */
  const joints = new Map(
    model.unions.map((union) => {
      const seats = union.partnerIds.map((id) => centres.get(id) ?? 0);
      const midpoint = mean(seats) ?? 0;

      if (sideBySide(union, generations, centres) || union.childIds.length === 0) {
        return [union.id, midpoint];
      }

      const kids = union.childIds.map((id) => centres.get(id) ?? 0);
      const wanted = (Math.min(...kids) + Math.max(...kids)) / 2;

      return [union.id, Math.min(Math.max(wanted, Math.min(...seats)), Math.max(...seats))];
    }),
  );
  const buses = assignBuses(model, generations, centres, joints, rowY);

  const edges: LayoutEdge[] = [];
  const junctions: Junction[] = [];

  for (const union of model.unions) {
    const row = Math.max(...union.partnerIds.map((id) => generations.get(id) ?? 0));
    const top = rowY(row);

    const couple = union.partnerIds.length === 2;
    // A union is only a marriage if both people said so. One inferred from a
    // shared child is a partnership, and the drawing should not claim more.
    const declared =
      union.partnerIds.length === 2 &&
      union.partnerIds.every((id, index) =>
        (model.byId.get(id)?.spouseIds ?? []).includes(union.partnerIds[1 - index]),
      );

    const together = sideBySide(union, generations, centres);

    /**
     * Where this marriage's line runs, and so where the drop to the children
     * begins. Side by side, it is the line between the two cards. Otherwise —
     * a third marriage, or a spouse who lives in another family's block — it
     * runs below the row, on a height of its own, because a line at card
     * height would disappear behind whoever is standing in between.
     */
    const lineY = together
      ? top + PERSON_HEIGHT / 2
      : (marriages.get(union.id) ?? top + PERSON_HEIGHT);

    nodes.push({
      id: union.id,
      kind: "union",
      x: (joints.get(union.id) ?? 0) - UNION_SIZE / 2,
      y: lineY - UNION_SIZE / 2,
      width: UNION_SIZE,
      height: UNION_SIZE,
    });

    if (together) {
      // One line from card to card. Two lines meeting at the joint would leave
      // a gap there, because a handle sits slightly outside the node it is on.
      const [left, right] = [...union.partnerIds].sort(
        (a, b) => (centres.get(a) ?? 0) - (centres.get(b) ?? 0),
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
        busY: buses.get(union.id),
        startY: lineY,
      });
    }

    junctions.push(
      ...junctionsFor(
        union,
        joints.get(union.id) ?? 0,
        lineY,
        buses.get(union.id),
        union.childIds.map((id) => centres.get(id) ?? 0),
        couple,
      ),
    );
  }

  const left = Math.min(...nodes.map((node) => node.x), 0);

  return {
    nodes: shiftToOrigin(nodes),
    edges,
    junctions: junctions.map((each) => ({ ...each, x: each.x - left })),
    generations,
  };
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;

/**
 * The meeting points of one union's lines.
 *
 * A point earns a dot when three or more segments run out of it. Two segments
 * is a corner, which needs no explaining, and anything that only looks like a
 * meeting — one union's bar laid across another's drop — never appears here at
 * all, which is what makes the absence of a dot mean something.
 */
function junctionsFor(
  union: Union,
  jointX: number,
  lineY: number,
  busY: number | undefined,
  childXs: number[],
  couple: boolean,
): Junction[] {
  if (childXs.length === 0 || busY === undefined) return [];

  const found: Junction[] = [];

  // Where the drop leaves the line the two partners share.
  if (couple) found.push({ id: `${union.id}@marriage`, x: jointX, y: lineY, on: "marriage" });

  const left = Math.min(jointX, ...childXs);
  const right = Math.max(jointX, ...childXs);
  const stops = childXs.some((x) => near(x, jointX)) ? childXs : [...childXs, jointX];

  for (const x of stops) {
    const arms =
      Number(x > left + 0.5) +
      Number(x < right - 0.5) +
      Number(childXs.some((childX) => near(childX, x))) +
      Number(near(x, jointX));

    if (arms >= 3) found.push({ id: `${union.id}@${Math.round(x)}`, x, y: busY, on: "descent" });
  }

  return found;
}

function shiftToOrigin(nodes: LayoutNode[]): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const left = Math.min(...nodes.map((node) => node.x));

  return nodes.map((node) => ({ ...node, x: node.x - left }));
}
