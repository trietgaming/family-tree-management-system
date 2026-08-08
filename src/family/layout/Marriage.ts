import { isDeclaredPair, type Union } from "../model";
import type { Card } from "./Card";
import type { Household } from "./Household";
import { PARTNER_GAP, PERSON_WIDTH } from "./geometry";

/**
 * A pairing as the drawing sees it: the cards standing in it, the children
 * hanging from it, and the three numbers the router works out — where the line
 * between the partners runs, where it hands over to the children, and how high
 * the bar to them sits.
 */
export class Marriage {
  readonly union: Union;
  readonly partners: Card[];
  readonly children: Card[];
  /** The partner drawn beside the head of this household, if either is. */
  readonly spouseHere: Card | null;
  /** The child households placed beneath this marriage, in order. */
  readonly below: Household[];

  /** All three are written by the router, once every card has a column. */
  jointX = 0;
  lineY = 0;
  barY: number | null = null;

  constructor(union: Union, partners: Card[], spouseHere: Card | null, children: Card[], below: Household[]) {
    this.union = union;
    this.partners = partners;
    this.spouseHere = spouseHere;
    this.children = children;
    this.below = below;
  }

  get id(): string {
    return this.union.id;
  }

  get isCouple(): boolean {
    return this.partners.length === 2;
  }

  get isDeclared(): boolean {
    return this.isCouple && isDeclaredPair(this.partners[0].person, this.partners[1].person);
  }

  /** Close enough on the same row to carry the line between their two cards. */
  get isSideBySide(): boolean {
    if (!this.isCouple) return false;

    const [a, b] = this.partners;
    if (a.row !== b.row) return false;

    return Math.abs(a.x - b.x) <= PERSON_WIDTH + PARTNER_GAP + 2;
  }

  /** Everyone this pairing is about, which is what its lines and marks join. */
  get peopleIds(): string[] {
    return [...this.partners, ...this.children].map((card) => card.id);
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
}
