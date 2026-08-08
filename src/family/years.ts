import type { Person } from "./model";

/** A year typed away to nothing is no year, not the number zero. */
export function yearFrom(typed: string): number | null {
  const year = Number.parseInt(typed, 10);

  return Number.isNaN(year) ? null : year;
}

/**
 * A stretch of time to look at the family through.
 *
 * Either end may be left open, and both open means no filter at all. It
 * answers about people rather than handing out its two numbers, so the rule
 * for somebody with no year recorded is stated once, here, instead of at every
 * place that compares.
 */
export class YearRange {
  readonly from: number | null;
  readonly to: number | null;

  private constructor(from: number | null, to: number | null) {
    this.from = from;
    this.to = to;
  }

  static of(from: number | null, to: number | null): YearRange {
    return new YearRange(from, to);
  }

  static readonly ANY: YearRange = YearRange.of(null, null);

  startingAt(year: number | null): YearRange {
    return YearRange.of(year, this.to);
  }

  endingAt(year: number | null): YearRange {
    return YearRange.of(this.from, year);
  }

  get isSet(): boolean {
    return this.from !== null || this.to !== null;
  }

  /**
   * Somebody with no year recorded is never outside the range.
   *
   * An absent year is not evidence of being born elsewhere in time — it is the
   * absence of evidence, and the same reading validation gives it: what is not
   * recorded contradicts nothing.
   */
  covers(person: Person): boolean {
    const born = person.birthYear;
    if (born === undefined) return true;

    return (this.from === null || born >= this.from) && (this.to === null || born <= this.to);
  }

  /** Who the filter pushes into the background. Empty while nothing is asked for. */
  outsiders(people: Person[]): Set<Person> {
    if (!this.isSet) return new Set();

    return new Set(people.filter((person) => !this.covers(person)));
  }
}
