import type { Card } from "./Card";
import type { Marriage } from "./Marriage";

/**
 * A person, whoever stands beside them, and everything descending from them.
 *
 * Every person belongs to exactly one household, which is what makes placing
 * them a plain tree walk with nothing to reconcile afterwards.
 */
export class Household {
  readonly head: Card;
  readonly marriages: Marriage[] = [];

  /** The cards on this household's own row, left to right. Set once ordered. */
  row: Card[] = [];

  constructor(head: Card) {
    this.head = head;
  }

  get spouses(): Card[] {
    return this.marriages
      .map((marriage) => marriage.spouseHere)
      .filter((card): card is Card => card !== null);
  }

  /** The households directly below, in the order their marriages are drawn. */
  get below(): Household[] {
    return this.marriages.flatMap((marriage) => marriage.below);
  }

  get descendants(): Household[] {
    return [this, ...this.below.flatMap((house) => house.descendants)];
  }

  /** Every card drawn in this household and everything under it. */
  get cards(): Card[] {
    return this.descendants.flatMap((house) => [house.head, ...house.spouses]);
  }
}
