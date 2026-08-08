import type { Card } from "./Card";
import {
  BUS_CLEARANCE,
  LANE_STEP,
  MARRIAGE_DROP,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  isNear,
  rowY,
  widthOf,
  type Span,
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
  /** Every card, because a line has to get past the ones it does not belong to. */
  private readonly cards: Card[];
  /** Where a partner's drop leaves its card, when the middle of it is taken. */
  private readonly drops = new Map<string, number>();
  readonly routes: Route[] = [];
  readonly junctions: Junction[] = [];

  constructor(marriages: Marriage[], cards: Card[]) {
    this.marriages = marriages;
    this.cards = cards;
  }

  run(): void {
    this.settleMarriages();
    this.settleJoints();
    this.settleBars();
    this.settleDrops();

    for (const marriage of this.marriages) {
      this.routes.push(...this.routeOf(marriage));
      this.junctions.push(...this.meetingsOf(marriage));
    }
  }

  private rowOf(marriage: Marriage): number {
    return Math.max(...marriage.partners.map((card) => card.row));
  }

  /**
   * The row a marriage's bar hangs under.
   *
   * The one above its highest child, not the one below its parents. Those are
   * usually the same row and only differ when a child sits more than one row
   * down — married to somebody from further along the line, most often. Hanging
   * the bar under the parents there would leave the drop to that child crossing
   * every row between, and any card standing in the way.
   */
  private barRowOf(marriage: Marriage): number {
    return Math.min(...marriage.children.map((card) => card.row)) - 1;
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
      const lanes = assignLanes(group);

      for (const claim of group) {
        claim.marriage.lineY = marriageLaneY(row, lanes.get(claim) ?? 0);
      }
    }
  }

  /**
   * Moves a handover off a column another one already leaves by.
   *
   * Somebody in two pairings whose children both lie beyond them gets both
   * handovers pushed onto their own column, and then two lines fall down it
   * together with nothing to tell them apart.
   *
   * Only a handover already pushed to the end of its line moves. It has given
   * up on standing over its children, so a step back along the line costs it
   * nothing; one still standing over them has something to lose and keeps it.
   */
  private settleJoints(): void {
    const claimed = new Map<number, number[]>();

    const isClaimed = (band: number, x: number) =>
      (claimed.get(band) ?? []).some((other) => Math.abs(other - x) < CLEARANCE);
    const claim = (band: number, x: number) =>
      claimed.set(band, [...(claimed.get(band) ?? []), x]);

    const handovers = this.marriages.filter((each) => each.children.length > 0);

    // A pair standing together hands over in the gap between them, and a gap is
    // not enough room to move in.
    for (const marriage of handovers) {
      if (marriage.isSideBySide) claim(this.barRowOf(marriage), marriage.jointX);
    }

    for (const marriage of handovers) {
      if (marriage.isSideBySide || !marriage.isCouple) continue;

      const band = this.barRowOf(marriage);
      const line = spanOf(marriage.seats);
      const inward = atEndOf(marriage.jointX, line);

      if (inward === 0) {
        claim(band, marriage.jointX);
        continue;
      }

      let at = marriage.jointX;
      while (isClaimed(band, at)) {
        const next = at + inward * LANE_STEP;
        // Stepping past the other end would take the handover off its own line.
        if (next < line.left || next > line.right) break;

        at = next;
      }

      marriage.jointX = at;
      claim(band, at);
    }
  }

  /** The same treatment for the bars out to children, stacked upwards. */
  private settleBars(): void {
    const claims: Claim[] = this.marriages
      .filter((marriage) => marriage.children.length > 0)
      .map((marriage) => ({
        marriage,
        row: this.barRowOf(marriage),
        ...spanOf([marriage.jointX, ...marriage.children.map((card) => card.x)]),
      }));

    for (const [row, group] of groupByRow(claims)) {
      const lanes = assignLanes(group);

      for (const claim of group) {
        claim.marriage.barY = barLaneY(row, lanes.get(claim) ?? 0);
      }
    }
  }

  /**
   * Moves a long drop off the middle of its card when the middle is spoken for.
   *
   * A partner standing a row above the marriage falls the whole depth of a band
   * that is not theirs, and anything already running down that column — another
   * union's handover, its line to a child — ends up drawn twice over. The two
   * then read as one line from the top of the first to the bottom of the last,
   * which is a parent-and-child that the document never claimed.
   *
   * Only these drops move. A short one stays under the middle of its card, and
   * several leaving one card together are a stem rather than a clash, which is
   * why runs starting at the same point are not counted against each other.
   */
  private settleDrops(): void {
    const fixed: (Span & { at: number })[] = [];

    for (const marriage of this.marriages) {
      if (marriage.barY === null) continue;

      fixed.push({ at: marriage.jointX, ...heightOf(marriage.lineY, marriage.barY) });

      for (const child of marriage.children) {
        fixed.push({ at: child.x, ...heightOf(marriage.barY, child.y) });
      }
    }

    for (const marriage of this.marriages) {
      if (marriage.isSideBySide || !marriage.isCouple) continue;

      const row = this.rowOf(marriage);
      const above = marriage.partners.filter((card) => card.row < row);

      for (const card of above) {
        const run = heightOf(card.foot, marriage.lineY);
        const towards = Math.sign(marriage.jointX - card.x) || 1;

        this.drops.set(
          dropKey(marriage, card),
          findFreeColumn(card, run, towards, this.cards, fixed),
        );
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
        const at = this.drops.get(dropKey(marriage, card)) ?? card.x;

        routes.push({
          id: `${card.id}->${marriage.id}`,
          marriage,
          kind: "marriage",
          from: card,
          to: null,
          points: [
            { x: at, y: card.foot },
            { x: at, y: lineY },
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
    const people = marriage.peopleIds;

    if (marriage.isCouple) {
      found.push({ id: `${marriage.id}@marriage`, x: jointX, y: lineY, on: "marriage", people });
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
        found.push({ id: `${marriage.id}@${Math.round(x)}`, x, y: barY, on: "descent", people });
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

/** The same, down the page: a vertical run reaches from one height to another. */
function heightOf(a: number, b: number): Span {
  return { left: Math.min(a, b), right: Math.max(a, b) };
}

/** Which way is inward when a point sits on an end of a span, and 0 when it does not. */
function atEndOf(x: number, span: Span): number {
  if (x <= span.left + 0.5) return 1;
  if (x >= span.right - 0.5) return -1;

  return 0;
}

function dropKey(marriage: Marriage, card: Card): string {
  return `${marriage.id}:${card.id}`;
}

/** How near two parallel runs may come before they read as one. */
const CLEARANCE = 8;
/** The corridor between two cards is only a gap wide, so the search is fine. */
const NUDGE = 4;

function isOverlappingHeight(a: Span, b: Span): boolean {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5;
}

/**
 * A column under the card where the drop stands on nothing.
 *
 * Two things are in the way: a card the run would fall through, and another
 * union's run down the same column. Runs starting where this one starts are
 * let past — several lines leaving one card together are that card's stem, and
 * a stem is read as a stem.
 *
 * The step is small because the room usually is: two cards standing together
 * leave a corridor one gap wide, and that corridor is often the only way down.
 */
function findFreeColumn(
  card: Card,
  run: Span,
  towards: number,
  cards: Card[],
  fixed: (Span & { at: number })[],
): number {
  const walls: Span[] = [
    ...cards
      .filter((other) => other !== card && isOverlappingHeight(run, heightOf(other.y, other.foot)))
      .map((other) => ({ left: other.left, right: other.right })),
    ...fixed
      .filter((other) => Math.abs(other.left - run.left) > 0.5 && isOverlappingHeight(run, other))
      .map((other) => ({ left: other.at - CLEARANCE, right: other.at + CLEARANCE })),
  ];

  const isTaken = (x: number) =>
    x < card.left + CLEARANCE ||
    x > card.right - CLEARANCE ||
    walls.some((wall) => x > wall.left && x < wall.right);

  const reach = Math.ceil(PERSON_WIDTH / 2 / NUDGE);

  for (let step = 0; step <= reach; step++) {
    for (const way of step === 0 ? [0] : [towards, -towards]) {
      const x = card.x + way * step * NUDGE;
      if (!isTaken(x)) return x;
    }
  }

  return card.x;
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

function findFreeLane<T extends Span>(run: T, taken: T[][]): number {
  let lane = 0;

  while ((taken[lane] ?? []).some((other) => isOverlapping(run, other))) lane++;

  return lane;
}

/**
 * Which lane each run belongs in, counting away from the cards.
 *
 * Narrowest first, so the local runs settle into the low lanes and one
 * reaching across the drawing is pushed above them.
 *
 * The search does not stop. A band with more runs in it than it has room for
 * used to hand the overflow a fixed lane, which put two lines at one height —
 * the very thing lanes exist to prevent. Crowding into the space below is the
 * lesser fault: the two kinds of lane can never land on the same height, since
 * one counts up from `rowY(r) + 86` and the other down from `rowY(r) + 134`,
 * eighteen at a time.
 */
function assignLanes<T extends Span>(runs: T[]): Map<T, number> {
  const lanes = new Map<T, number>();
  const taken: T[][] = [];

  const narrowestFirst = [...runs].sort((a, b) => widthOf(a) - widthOf(b));

  for (const run of narrowestFirst) {
    const lane = findFreeLane(run, taken);

    const occupants = taken[lane] ?? [];
    occupants.push(run);
    taken[lane] = occupants;

    lanes.set(run, lane);
  }

  return lanes;
}
