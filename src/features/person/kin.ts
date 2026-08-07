import type { Person } from "../../family/schema";

/**
 * Everyone descended from this person.
 *
 * The parent pickers leave these out. Choosing one would make the person their
 * own ancestor, which is an error rather than a warning — the drawing would
 * stop at the last document that held together, and a picker that can freeze
 * the page is a picker offering the wrong thing.
 */
export function descendantsOf(people: Person[], personId: string): Set<string> {
  const below = new Set<string>();

  for (let growing = true; growing; ) {
    growing = false;

    for (const person of people) {
      if (below.has(person.id)) continue;

      const parents = [person.fatherId, person.motherId];
      if (!parents.some((id) => id === personId || (id != null && below.has(id)))) continue;

      below.add(person.id);
      growing = true;
    }
  }

  return below;
}

/** Who this person could be joined to: everybody but themselves and their line. */
export function candidatesFor(people: Person[], person: Person): Person[] {
  const below = descendantsOf(people, person.id);

  return people.filter((each) => each.id !== person.id && !below.has(each.id));
}

export function labelOf(person: Person): string {
  return person.birthYear === undefined ? person.name : `${person.name} (${person.birthYear})`;
}
