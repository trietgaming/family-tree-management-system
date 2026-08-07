import { isDeclaredUnion, parentIdsOf, type FamilyModel, type Union } from "../model";
import { Block } from "./Block";
import { Card } from "./Card";
import { assignGenerations } from "./generations";
import {
  CARD_STEP,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  SIBLING_GAP,
  TREE_GAP,
  UNION_SIZE,
  mean,
} from "./geometry";
import { Household } from "./Household";
import { Marriage } from "./Marriage";
import { Router } from "./Router";
import type { Layout, LayoutEdge, LayoutNode } from "./types";

/**
 * The drawing, as a set of things rather than a set of numbers.
 *
 * Building one runs it to completion — cards made, households grown, columns
 * placed, lines routed — so a chart is never half made and there is no order
 * of operations for a caller to get wrong.
 */
export class Chart {
  private readonly model: FamilyModel;
  private readonly cards = new Map<string, Card>();
  private readonly roots: Household[] = [];
  private readonly marriages: Marriage[] = [];
  private readonly router: Router;

  constructor(model: FamilyModel) {
    this.model = model;

    const rows = assignGenerations(model);
    for (const person of model.order) {
      this.cards.set(person.id, new Card(person, rows.get(person.id) ?? 0));
    }

    this.grow();
    this.leanBranches();
    this.fillRows();
    this.placeColumns();
    this.findJoints();

    this.router = new Router(this.marriages);
    this.router.run();
  }

  /**
   * Whether this pairing may seat that person beside the one it reached them
   * through.
   *
   * A pairing only inferred from a shared child does not get to take somebody
   * who has a marriage of their own waiting for them — the marriage would then
   * be the long line across the drawing and the weaker claim the short one,
   * which is backwards. Somebody with no marriage at all has nothing to wait
   * for, and is seated wherever they are first reached.
   */
  private isSeatEarned(union: Union, other: Card): boolean {
    if (isDeclaredUnion(this.model, union)) return true;

    return !(this.model.unionsOf.get(other.id) ?? []).some((each) =>
      isDeclaredUnion(this.model, each),
    );
  }

  private cardOf(id: string): Card {
    const card = this.cards.get(id);
    if (!card) throw new Error(`No card for "${id}"`);

    return card;
  }

  /**
   * Grows the households, giving every person one home: the first place the
   * walk reaches them. A spouse nobody has claimed is drawn beside their
   * partner, which keeps couples together even when they come from different
   * families — the price is that the link up to their own parents is a long
   * one. That is the trade the whole drawing rests on, and it is the reason
   * every joint can sit exactly above its own children.
   */
  private grow(): void {
    const placed = new Set<string>();
    // Across every household, not just this one: a pairing whose two partners
    // end up in different houses would otherwise be built once by each.
    const drawn = new Set<string>();

    const build = (personId: string): Household => {
      placed.add(personId);

      const house = new Household(this.cardOf(personId));
      const household = [personId];

      // A spouse brings their own other marriages into this house with them.
      for (let i = 0; i < household.length; i++) {
        const here = this.cardOf(household[i]);

        for (const union of this.model.unionsOf.get(here.id) ?? []) {
          if (drawn.has(union.id)) continue;
          drawn.add(union.id);

          const otherId = union.partnerIds.find((id) => id !== here.id);
          const other = otherId === undefined ? null : this.cardOf(otherId);

          // Only a partner on the same row can stand beside them. One on
          // another row keeps their own home, and the pairing is drawn as a
          // link between the two rows.
          const isSeatOffered =
            other !== null &&
            !placed.has(other.id) &&
            other.row === here.row &&
            this.isSeatEarned(union, other);

          const spouse = isSeatOffered ? other : null;

          if (spouse !== null) {
            placed.add(spouse.id);
            household.push(spouse.id);
          }

          // Claim the children before recursing, so a sibling cannot be pulled
          // away and drawn as somebody's spouse instead.
          const mine = union.childIds.filter((id) => !placed.has(id));
          for (const id of mine) placed.add(id);

          const marriage = new Marriage(
            union,
            union.partnerIds.map((id) => this.cardOf(id)),
            spouse,
            union.childIds.map((id) => this.cardOf(id)),
            mine.map(build),
          );

          house.marriages.push(marriage);
          this.marriages.push(marriage);
        }
      }

      return house;
    };

    for (const person of this.model.order) {
      if (placed.has(person.id) || this.model.bornInto.has(person.id)) continue;
      this.roots.push(build(person.id));
    }

    // Anything still unplaced is disconnected from every root; give it its own.
    for (const person of this.model.order) {
      if (!placed.has(person.id)) this.roots.push(build(person.id));
    }
  }

  /**
   * A spouse drawn beside their partner keeps their own parents in whichever
   * tree those parents belong to, so the line up to them has to cross. It is
   * shortest when that spouse sits on the side facing the family they came
   * from, which is what sorting by lean arranges.
   */
  private leanBranches(): void {
    const home = new Map<string, number>();
    this.roots.forEach((root, index) => {
      for (const card of root.cards) home.set(card.id, index);
    });

    const leanOf = (house: Household, from: number): number => {
      const elsewhere = house.descendants
        .flatMap((each) => each.cards)
        .flatMap((card) => parentIdsOf(this.model, card.id))
        .map((parentId) => home.get(parentId))
        .filter((index): index is number => index !== undefined && index !== from);

      const average = mean(elsewhere);

      return average === null ? 0 : average - from;
    };

    this.roots.forEach((root, from) => {
      for (const house of root.descendants) {
        const lean = new Map(
          house.marriages.map((marriage) => [
            marriage,
            mean(marriage.below.map((child) => leanOf(child, from))) ?? 0,
          ]),
        );

        house.marriages.sort((a, b) => (lean.get(a) ?? 0) - (lean.get(b) ?? 0));
      }
    });
  }

  /**
   * Somebody with one spouse keeps the order the document gives them; somebody
   * with several stands in the middle, so every joint has a partner beside it.
   */
  private fillRows(): void {
    const order = new Map(this.model.order.map((person, index) => [person.id, index]));
    const at = (card: Card) => order.get(card.id) ?? 0;

    for (const root of this.roots) {
      for (const house of root.descendants) {
        const spouses = house.spouses;

        if (spouses.length === 0) house.row = [house.head];
        else if (spouses.length === 1) {
          house.row =
            at(house.head) <= at(spouses[0])
              ? [house.head, spouses[0]]
              : [spouses[0], house.head];
        } else {
          house.row = [spouses[0], house.head, ...spouses.slice(1)];
        }
      }
    }
  }

  private placeColumns(): void {
    let cursor = 0;

    for (const root of this.roots) {
      const block = this.lay(root);
      block.commit(cursor);
      cursor += block.width + TREE_GAP;
    }

    // Everything is measured from wherever the first tree started; slide the
    // whole drawing so the leftmost card sits on zero.
    const left = Math.min(...[...this.cards.values()].map((card) => card.left), 0);
    for (const card of this.cards.values()) card.x -= left;
  }

  /**
   * Lays out one household and everything below it, in its own coordinates.
   *
   * Children go down first, because where they land is what the row above has
   * to line up with. A block is aligned by the child's own card rather than by
   * the middle of its width — the middle is the gap between the child and the
   * child's spouse, and lining a parent up with that makes the line to an only
   * child jog sideways for nothing.
   */
  private lay(house: Household): Block {
    const parts: { block: Block; dx: number }[] = [];
    const wanted = new Map<number, number>();
    let cursor = 0;

    for (const marriage of house.marriages) {
      const anchors: number[] = [];

      for (const child of marriage.below) {
        const block = this.lay(child);
        parts.push({ block, dx: cursor });
        anchors.push(cursor + block.anchor);
        cursor += block.width + SIBLING_GAP;
      }

      if (anchors.length === 0) continue;

      // Only the gap between two neighbouring cards can be widened to suit; a
      // marriage that already runs below the row is not held to this.
      const seats = marriage.partners
        .map((card) => house.row.indexOf(card))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b);

      const middle = (Math.min(...anchors) + Math.max(...anchors)) / 2;

      // A partner living in another household leaves no seat to widen against,
      // but the marriage then runs below the row and its joint is free to slide
      // along it — so it needs nothing here. Only a genuinely single parent,
      // whose joint is pinned to their own card, moves the row.
      if (seats.length === 2 && seats[1] === seats[0] + 1) wanted.set(seats[0], middle);
      else if (seats.length === 1 && !marriage.isCouple) {
        wanted.set(-1, middle - seats[0] * CARD_STEP - PERSON_WIDTH / 2);
      }
    }

    // A lone parent has no gap to widen, so the whole row slides instead.
    const slide = wanted.get(-1) ?? 0;
    const at = spaceRow(house.row.length, wanted).map((x) => x + slide);

    const below = Block.layAt(parts);
    const row = Block.layRow(house.row, at, house.row.indexOf(house.head));

    return Block.stackAbove(row, Math.min(...at) - PERSON_WIDTH / 2, below, 0);
  }

  /**
   * Where along its own line each marriage hands over to its children.
   *
   * Two people standing together have one sensible point, the gap between
   * them. A marriage drawn below the row is already a horizontal run from one
   * card to the other, so the handover can be anywhere along it — and directly
   * above the children costs no sideways jog. Only when the children lie
   * outside the run does it settle for the nearest end.
   */
  private findJoints(): void {
    for (const marriage of this.marriages) {
      const seats = marriage.seats;
      const midpoint = mean(seats) ?? 0;

      if (marriage.isSideBySide || marriage.children.length === 0) {
        marriage.jointX = midpoint;
        continue;
      }

      const kids = marriage.children.map((card) => card.x);
      const wanted = (Math.min(...kids) + Math.max(...kids)) / 2;

      marriage.jointX = Math.min(Math.max(wanted, Math.min(...seats)), Math.max(...seats));
    }
  }

  toLayout(): Layout {
    const nodes: LayoutNode[] = this.model.order.map((person) => {
      const card = this.cardOf(person.id);

      return {
        id: card.id,
        kind: "person",
        x: card.left,
        y: card.y,
        width: PERSON_WIDTH,
        height: PERSON_HEIGHT,
      };
    });

    for (const marriage of this.marriages) {
      nodes.push({
        id: marriage.id,
        kind: "union",
        x: marriage.jointX - UNION_SIZE / 2,
        y: marriage.lineY - UNION_SIZE / 2,
        width: UNION_SIZE,
        height: UNION_SIZE,
      });
    }

    const edges: LayoutEdge[] = this.router.routes.map((route) => ({
      id: route.id,
      source: route.from?.id ?? route.marriage.id,
      target: route.to?.id ?? route.marriage.id,
      kind: route.kind,
      declared: route.kind === "marriage" ? route.marriage.isDeclared : undefined,
      points: route.points,
    }));

    return {
      nodes,
      edges,
      junctions: this.router.junctions,
      generations: new Map([...this.cards].map(([id, card]) => [id, card.row])),
    };
  }
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
function spaceRow(cards: number, wanted: Map<number, number>): number[] {
  const first = wanted.get(0);
  const at = [first === undefined ? PERSON_WIDTH / 2 : first - CARD_STEP / 2];

  for (let i = 1; i < cards; i++) {
    const joint = wanted.get(i - 1);

    at.push(
      joint === undefined
        ? at[i - 1] + CARD_STEP
        : Math.max(at[i - 1] + CARD_STEP, 2 * joint - at[i - 1]),
    );
  }

  return at;
}
