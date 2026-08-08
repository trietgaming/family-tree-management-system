/**
 * A person's identity as the document writes it.
 *
 * Only the two boundaries speak in these — the text coming in, and the node
 * ids going out to React Flow. In between, a person is identified by being
 * that person, so anything holding one of these instead of a `Person` is
 * either at a boundary or is a mistake.
 *
 * A type of its own rather than a bare string, because the operations around
 * renaming take two ids and a list of ids, and nothing about three strings in
 * a row says which is which.
 */
export class PersonId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static of(value: string): PersonId {
    return new PersonId(value);
  }

  equals(other: PersonId): boolean {
    return this.value === other.value;
  }

  /** Trailing space is a typo, not a different person. */
  get isBlank(): boolean {
    return this.value.trim() === "";
  }

  toString(): string {
    return this.value;
  }
}
