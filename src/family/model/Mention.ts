import type { Person } from "./Person";
import type { PersonId } from "./PersonId";

/**
 * Somebody a person's record names, who may or may not be in the document.
 *
 * Naming a stranger is a warning rather than an error, so the family still
 * draws and the form still opens — which means the form has to be able to show
 * the name and take it back out again. A `Person` cannot stand for that, and
 * neither can a bare id: one of them is missing the fact that nobody is there,
 * the other is missing everything else.
 */
export class Mention {
  readonly id: PersonId;
  private readonly found: Person | null;

  private constructor(id: PersonId, found: Person | null) {
    this.id = id;
    this.found = found;
  }

  static of(id: PersonId, found: Person | null): Mention {
    return new Mention(id, found);
  }

  get person(): Person | null {
    return this.found;
  }

  get isKnown(): boolean {
    return this.found !== null;
  }
}
