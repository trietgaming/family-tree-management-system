import { childrenOf, peopleIn } from "./forest";
import { CARD_STEP, PERSON_WIDTH, SIBLING_GAP, TREE_GAP } from "./geometry";
import type { TreeNode } from "./types";

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

/**
 * Lays out every tree and puts them side by side. The forest is walked once,
 * each root in its own coordinates, and then slid into place.
 */
export function spreadForest(forest: TreeNode[]): Map<string, number> {
  const centres = new Map<string, number>();
  let cursor = 0;

  for (const tree of forest) {
    const laid = arrange(tree, centres);
    shiftSubtree(tree, cursor, centres);
    cursor += laid.width + TREE_GAP;
  }

  return centres;
}
