import type { PersonRecord } from "./schema";

/** Either end may be left open, and both open means no filter at all. */
export type YearRange = { from: number | null; to: number | null };

export const ANY_YEAR: YearRange = { from: null, to: null };

/** A year typed away to nothing is no year, not the number zero. */
export function yearFrom(typed: string): number | null {
  const year = Number.parseInt(typed, 10);

  return Number.isNaN(year) ? null : year;
}

export function isRangeSet(range: YearRange): boolean {
  return range.from !== null || range.to !== null;
}

/**
 * Somebody with no year recorded is never outside the range.
 *
 * An absent year is not evidence of being born elsewhere in time — it is the
 * absence of evidence, and the same reading validation gives it: what is not
 * recorded contradicts nothing.
 */
export function isWithinRange(person: PersonRecord, range: YearRange): boolean {
  if (person.birthYear === undefined) return true;

  return (
    (range.from === null || person.birthYear >= range.from) &&
    (range.to === null || person.birthYear <= range.to)
  );
}

/** Who the filter pushes into the background. Empty while nothing is asked for. */
export function findOutsideRange(people: PersonRecord[], range: YearRange): Set<string> {
  if (!isRangeSet(range)) return new Set();

  return new Set(
    people.filter((person) => !isWithinRange(person, range)).map((person) => person.id),
  );
}
