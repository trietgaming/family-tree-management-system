import type { Card } from "./Card";
import {
  BUS_CLEARANCE,
  LANE_STEP,
  MARRIAGE_DROP,
  PERSON_HEIGHT,
  isNear,
  rowY,
} from "./geometry";
import type { Marriage } from "./Marriage";
import type { Junction, Point } from "./types";

export type Route = {
  id: string;
  marriage: Marriage;
  kind: "marriage" | "child";
  from: Card | null;
  to: Card | null;
  points: Point[];
};

type Span = { left: number; right: number };
type Claim = Span & { marriage: Marriage; row: number };

/**
 * Works out where every line runs.
 *
 * A marriage between two cards standing together needs nothing but the gap
 * between them. Anything else — a third marriage, a spouse in another family's
 * block, the drop to a set of children — has to cross the band between two
 * rows, and lines crossing the same band have to be kept off one another.
 */
export class Router {
  private readonly marriages: Marriage[];
  readonly routes: Route[] = [];
  readonly junctions: Junction[] = [];

  constructor(marriages: Marriage[]) {
    this.marriages = marriages;
  }

  run(): void {
    this.settleMarriages();
    this.settleBars();

    for (const marriage of this.marriages) {
      this.routes.push(...this.routeOf(marriage));
      this.junctions.push(...this.meetingsOf(marriage));
    }
  }

  private rowOf(marriage: Marriage): number {
    return Math.max(...marriage.partners.map((card) => card.row));
  }

  /**
   * Marriages that cannot use the gap between two cards run below the row, and
   * two of them at one height would read as a single line. Overlapping ones are
   * stacked downwards from the foot of the row.
   */
  private settleMarriages(): void {
    const claims: Claim[] = [];

    for (const marriage of this.marriages) {
      const row = this.rowOf(marriage);

      if (marriage.isSideBySide) {
        marriage.lineY = rowY(row) + PERSON_HEIGHT / 2;
        continue;
      }

      marriage.lineY = rowY(row) + PERSON_HEIGHT;
      if (!marriage.isCouple) continue;

      claims.push({ marriage, row, ...spanOf(marriage.seats) });
    }

    for (const [row, group] of groupByRow(claims)) {
      const lanes = assignLanes(group, laneCountBelow(row));

      for (const claim of group) {
        claim.marriage.lineY = marriageLaneY(row, lanes.get(claim) ?? 0);
      }
    }
  }

  /** The same treatment for the bars out to children, stacked upwards. */
  private settleBars(): void {
    const claims: Claim[] = this.marriages
      .filter((marriage) => marriage.children.length > 0)
      .map((marriage) => ({
        marriage,
        row: this.rowOf(marriage),
        ...spanOf([marriage.jointX, ...marriage.children.map((card) => card.x)]),
      }));

    for (const [row, group] of groupByRow(claims)) {
      const lanes = assignLanes(group, Number.POSITIVE_INFINITY);

      for (const claim of group) {
        claim.marriage.barY = barLaneY(row, lanes.get(claim) ?? 0);
      }
    }
  }

  private routeOf(marriage: Marriage): Route[] {
    const routes: Route[] = [];
    const { lineY, barY, jointX } = marriage;

    if (marriage.isSideBySide) {
      // One run from card to card. Two runs meeting in the middle would leave
      // a gap there, and a gap in a line reads as a dash.
      const [left, right] = [marriage.leftPartner, marriage.rightPartner];

      routes.push({
        id: `${left.id}~${right.id}`,
        marriage,
        kind: "marriage",
        from: left,
        to: right,
        points: [
          { x: left.right, y: left.middle },
          { x: right.left, y: right.middle },
        ],
      });
    } else if (marriage.isCouple) {
      for (const card of marriage.partners) {
        routes.push({
          id: `${card.id}->${marriage.id}`,
          marriage,
          kind: "marriage",
          from: card,
          to: null,
          points: [
            { x: card.x, y: card.foot },
            { x: card.x, y: lineY },
            { x: jointX, y: lineY },
          ],
        });
      }
    }

    if (barY === null) return routes;

    for (const child of marriage.children) {
      routes.push({
        id: `${marriage.id}->${child.id}`,
        marriage,
        kind: "child",
        from: null,
        to: child,
        points: [
          { x: jointX, y: lineY },
          { x: jointX, y: barY },
          { x: child.x, y: barY },
          { x: child.x, y: child.y },
        ],
      });
    }

    return routes;
  }

  /**
   * Where this marriage's own lines meet, which is where a dot belongs.
   *
   * Three or more arms out of a point is a meeting; two is a corner and needs
   * no explaining. Lines of *different* marriages crossing are never counted,
   * and that is what makes an unmarked crossing mean something.
   */
  private meetingsOf(marriage: Marriage): Junction[] {
    const { barY, jointX, lineY } = marriage;
    if (barY === null || marriage.children.length === 0) return [];

    const found: Junction[] = [];

    // Where the drop leaves the line the two partners share.
    if (marriage.isCouple) {
      found.push({ id: `${marriage.id}@marriage`, x: jointX, y: lineY, on: "marriage" });
    }

    const kids = marriage.children.map((card) => card.x);
    const left = Math.min(jointX, ...kids);
    const right = Math.max(jointX, ...kids);
    const stops = kids.some((x) => isNear(x, jointX)) ? kids : [...kids, jointX];

    for (const x of stops) {
      const arms =
        Number(x > left + 0.5) +
        Number(x < right - 0.5) +
        Number(kids.some((kid) => isNear(kid, x))) +
        Number(isNear(x, jointX));

      if (arms >= 3) {
        found.push({ id: `${marriage.id}@${Math.round(x)}`, x, y: barY, on: "descent" });
      }
    }

    return found;
  }
}

function groupByRow<T extends { row: number }>(claims: T[]): Map<number, T[]> {
  const rows = new Map<number, T[]>();
  for (const claim of claims) rows.set(claim.row, [...(rows.get(claim.row) ?? []), claim]);

  return rows;
}

/** The horizontal reach of a run, from its leftmost point to its rightmost. */
function spanOf(xs: number[]): Span {
  return { left: Math.min(...xs), right: Math.max(...xs) };
}

function widthOf(span: Span): number {
  return span.right - span.left;
}

/**
 * Two runs at one height that would be read as a single line.
 *
 * Meeting at one end counts: two runs sharing an endpoint are collinear, and a
 * reader has no way to see where one stops. A run with no width is the
 * exception, because it draws no horizontal at all and so cannot join anything.
 */
function isOverlapping(a: Span, b: Span): boolean {
  if (widthOf(a) < 0.5 || widthOf(b) < 0.5) return false;

  return a.left <= b.right && b.left <= a.right;
}

/** A marriage below the row: lane zero hugs the foot, and they stack downwards. */
function marriageLaneY(row: number, lane: number): number {
  return rowY(row) + PERSON_HEIGHT + MARRIAGE_DROP + lane * LANE_STEP;
}

/** A bar to children: lane zero hugs their row, and they stack upwards. */
function barLaneY(row: number, lane: number): number {
  return rowY(row + 1) - BUS_CLEARANCE - lane * LANE_STEP;
}

/** How many lanes fit between the foot of a row and the highest bar below it. */
function laneCountBelow(row: number): number {
  const room = barLaneY(row, 1) - marriageLaneY(row, 0);

  return Math.max(0, Math.floor(room / LANE_STEP));
}

function findFreeLane<T extends Span>(run: T, taken: T[][], search: number): number {
  let lane = 0;

  while (lane < search && (taken[lane] ?? []).some((other) => isOverlapping(run, other))) lane++;

  return lane;
}

/**
 * Which lane each run belongs in, counting away from the cards.
 *
 * Narrowest first, so the local runs settle into the low lanes and one
 * reaching across the drawing is pushed above them. `search` is how many lanes
 * there is room to look through; a run that fits in none of them takes the
 * next lane up rather than being dropped, which is the least bad answer when
 * the band is full.
 */
function assignLanes<T extends Span>(runs: T[], search: number): Map<T, number> {
  const lanes = new Map<T, number>();
  const taken: T[][] = [];

  const narrowestFirst = [...runs].sort((a, b) => widthOf(a) - widthOf(b));

  for (const run of narrowestFirst) {
    const lane = findFreeLane(run, taken, search);

    const occupants = taken[lane] ?? [];
    occupants.push(run);
    taken[lane] = occupants;

    lanes.set(run, lane);
  }

  return lanes;
}
