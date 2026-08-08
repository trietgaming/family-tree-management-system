import type { Person } from "../../family/model";

/** How somebody is named in a list, where a bare name may belong to two people. */
export function labelOf(person: Person): string {
  return person.birthYear === undefined ? person.name : `${person.name} (${person.birthYear})`;
}
