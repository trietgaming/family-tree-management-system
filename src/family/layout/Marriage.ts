import type { Person, Union } from "../model";
import type { Card } from "./Card";
import type { Household } from "./Household";
import { PARTNER_GAP, PERSON_WIDTH } from "./geometry";

/**
 * A pairing as the drawing sees it: the cards standing in it, the children
 * hanging from it, and the numbers the router works out — where the line
 * between the partners runs, where it hands over to the children, how high the
 * bar to them sits, and which column each partner falls down.
 */
export class Marriage {
  readonly union: Union;
  readonly partners: Card[];
  readonly children: Card[];
  /** The partner drawn beside the head of this household, if either is. */
  readonly spouseHere: Card | null;
  /** The child households placed beneath this marriage, in order. */
  readonly below: Household[];

  /** All written by the router, once every card has a column. */
  jointX = 0;
  lineY = 0;
  barY: number | null = null;
  private readonly drops = new Map<Card, number>();

  private constructor(
    union: Union,
    partners: Card[],
    spouseHere: Card | null,
    children: Card[],
    below: Household[],
  ) {
    this.union = union;
    this.partners = partners;
    this.spouseHere = spouseHere;
    this.children = children;
    this.below = below;
  }

  static of(
    union: Union,
    partners: Card[],
    spouseHere: Card | null,
    children: Card[],
    below: Household[],
  ): Marriage {
    return new Marriage(union, partners, spouseHere, children, below);
  }

  get id(): string {
    return this.union.id;
  }

  get isCouple(): boolean {
    return this.partners.length === 2;
  }

  get isDeclared(): boolean {
    return this.union.isDeclared;
  }

  /** Close enough on the same row to carry the line between their two cards. */
  get isSideBySide(): boolean {
    if (!this.isCouple) return false;

    const [a, b] = this.partners;
    if (a.row !== b.row) return false;

    return Math.abs(a.x - b.x) <= PERSON_WIDTH + PARTNER_GAP + 2;
  }

  /** Everyone this pairing is about, which is what its lines and marks join. */
  get people(): Person[] {
    return [...this.partners, ...this.children].map((card) => card.person);
  }

  get seats(): number[] {
    return this.partners.map((card) => card.x);
  }

  get leftPartner(): Card {
    return [...this.partners].sort((a, b) => a.x - b.x)[0];
  }

  get rightPartner(): Card {
    return [...this.partners].sort((a, b) => a.x - b.x)[1];
  }

  /**
   * Where a partner's line leaves their card. The middle of it, unless the
   * router had to move off a column something else was already falling down.
   */
  dropOf(card: Card): number {
    return this.drops.get(card) ?? card.x;
  }

  noteDrop(card: Card, x: number): void {
    this.drops.set(card, x);
  }
}
