import type { Person } from "./Person";

/**
 * A pairing, which the diagram draws as a joint: parents connect down into it,
 * children hang off it.
 *
 * This is the thing the document does not contain and the drawing cannot do
 * without. Family trees are not trees — a child has two parents, and a parent
 * can appear in several pairings — so there has to be something standing for
 * "these people, together", or there is nowhere for a line to meet.
 */
export class Union {
  private readonly held: Person[];
  private readonly born: Person[];

  private constructor(partners: Person[], children: Person[]) {
    this.held = partners;
    this.born = children;
  }

  /** Partners in a settled order, so that two ways of naming the same pairing agree. */
  static of(partners: Person[], children: Person[]): Union {
    return new Union(
      [...partners].sort((a, b) => (a.id.value < b.id.value ? -1 : 1)),
      children,
    );
  }

  /** Prefixed because unions and people end up as node ids in the same diagram. */
  get id(): string {
    return `union:${this.held.map((person) => person.id.value).join("+")}`;
  }

  /** One or two people. One when only a single parent is known. */
  get partners(): Person[] {
    return this.held;
  }

  get children(): Person[] {
    return this.born;
  }

  get isCouple(): boolean {
    return this.held.length === 2;
  }

  get isDeclared(): boolean {
    const [a, b] = this.held;

    return this.isCouple && a.isDeclaredPartnerOf(b);
  }

  has(person: Person): boolean {
    return this.held.includes(person);
  }

  /** Whoever else stands in this pairing, when a pairing reached through one person. */
  partnerBesides(person: Person): Person | null {
    return this.held.find((each) => each !== person) ?? null;
  }
}
