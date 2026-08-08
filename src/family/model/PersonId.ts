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

  /**
   * Trimmed on the way in, because the schema trims before it looks for
   * duplicates: two ids differing only in spaces are already the same person
   * as far as the document is concerned, and this is the one place that can be
   * settled once.
   */
  static of(value: string): PersonId {
    return new PersonId(value.trim());
  }

  /**
   * An opaque id for a person the user just created.
   *
   * Ids only have to be unique inside one document, so forty bits is already
   * far more than the situation needs; the collision check is what makes the
   * length a matter of tidiness rather than of correctness. Hex rather than
   * base 36 because mapping bytes onto a 36-letter alphabet skews the
   * distribution, and an unbiased generator is less to explain than a biased
   * one that happens not to matter.
   */
  static fresh(taken: PersonId[]): PersonId {
    let id = PersonId.of(randomText());
    while (taken.some((each) => each.equals(id))) id = PersonId.of(randomText());

    return id;
  }

  equals(other: PersonId): boolean {
    return this.value === other.value;
  }

  get isBlank(): boolean {
    return this.value === "";
  }

  toString(): string {
    return this.value;
  }
}

const BYTES = 5;

function randomText(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES));

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
