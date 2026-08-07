import type { Family, Person } from "./schema";

export type Problem = {
  /** Where in the document, as `people[3].fatherId`. Empty for the document as a whole. */
  path: string;
  /** The same location, kept in parts so the editor can find it in the text. */
  segments: readonly PropertyKey[];
  message: string;
};

const PARENT_FIELDS = ["fatherId", "motherId"] as const;
const LINK_FIELDS = ["spouseIds", "siblingIds"] as const;

export function formatPath(segments: readonly PropertyKey[]): string {
  return segments.reduce<string>((path, segment) => {
    if (typeof segment === "number") return `${path}[${segment}]`;

    return path ? `${path}.${String(segment)}` : String(segment);
  }, "");
}

export function problem(segments: readonly PropertyKey[], message: string): Problem {
  return { path: formatPath(segments), segments, message };
}

/**
 * Everything the schema cannot see, because it needs the whole graph rather
 * than one field at a time. An empty result means the family holds together.
 */
export function findProblems(family: Family): Problem[] {
  const { people } = family;
  const byId = indexById(people);

  return [
    ...duplicateIds(people),
    ...brokenReferences(people, byId),
    ...ancestryLoops(byId),
    ...contradictorySiblings(people, byId),
  ];
}

/** First occurrence wins, so every other check sees one person per id. */
function indexById(people: Person[]): Map<string, Person> {
  const byId = new Map<string, Person>();

  for (const person of people) {
    if (!byId.has(person.id)) byId.set(person.id, person);
  }

  return byId;
}

function parentsOf(person: Person): string[] {
  return PARENT_FIELDS.map((field) => person[field]).filter((id): id is string => Boolean(id));
}

function unknownId(id: string): string {
  return `No person has the id "${id}"`;
}

function duplicateIds(people: Person[]): Problem[] {
  const seen = new Set<string>();

  return people.flatMap((person, index) => {
    if (!seen.has(person.id)) {
      seen.add(person.id);
      return [];
    }

    return [problem(["people", index, "id"], `Duplicate id "${person.id}"`)];
  });
}

function brokenReferences(people: Person[], byId: Map<string, Person>): Problem[] {
  const problems: Problem[] = [];

  people.forEach((person, index) => {
    for (const field of PARENT_FIELDS) {
      const target = person[field];
      if (!target) continue;

      if (target === person.id) {
        problems.push(
          problem(["people", index, field], `${person.name} cannot be their own parent`),
        );
      } else if (!byId.has(target)) {
        problems.push(problem(["people", index, field], unknownId(target)));
      }
    }

    for (const field of LINK_FIELDS) {
      person[field]?.forEach((target, position) => {
        if (byId.has(target)) return;

        problems.push(problem(["people", index, field, position], unknownId(target)));
      });
    }
  });

  return problems;
}

/**
 * A loop would make the generation pass in the layout run forever, so it is
 * refused here rather than left to hang a tab. Only the first one is reported:
 * the others are usually the same loop entered from somewhere else.
 */
function ancestryLoops(byId: Map<string, Person>): Problem[] {
  const acyclic = new Set<string>();

  for (const id of byId.keys()) {
    const loop = loopAbove(id, byId, [], acyclic);

    // Someone set as their own parent loops in a single step, and
    // brokenReferences already says that in plainer words.
    if (!loop || loop.length === 2) continue;

    const names = loop.map((each) => byId.get(each)?.name ?? each);

    return [problem(["people"], `Ancestry loops back on itself: ${names.join(" → ")}`)];
  }

  return [];
}

/**
 * Walks up through both parents and returns the chain that repeats, or null.
 * `trail` is the path taken to get here, so meeting an id already on it is the
 * loop; `acyclic` remembers who has been cleared, which keeps this linear
 * instead of re-walking every shared ancestor once per descendant.
 */
function loopAbove(
  id: string,
  byId: Map<string, Person>,
  trail: string[],
  acyclic: Set<string>,
): string[] | null {
  if (acyclic.has(id)) return null;

  const repeated = trail.indexOf(id);
  if (repeated !== -1) return [...trail.slice(repeated), id];

  const person = byId.get(id);
  if (!person) return null;

  for (const parentId of parentsOf(person)) {
    if (!byId.has(parentId)) continue;

    const loop = loopAbove(parentId, byId, [...trail, id], acyclic);
    if (loop) return loop;
  }

  acyclic.add(id);

  return null;
}

/**
 * `siblingIds` is redundant with the parents, and accepted only because the
 * brief names the field. The parents win, and a contradiction is reported
 * rather than quietly resolved.
 */
function contradictorySiblings(people: Person[], byId: Map<string, Person>): Problem[] {
  const problems: Problem[] = [];

  people.forEach((person, index) => {
    const parents = new Set(parentsOf(person));

    person.siblingIds?.forEach((siblingId, position) => {
      const at = ["people", index, "siblingIds", position];

      if (siblingId === person.id) {
        problems.push(problem(at, `${person.name} is listed as their own sibling`));
        return;
      }

      // A dangling id is already reported by brokenReferences.
      const sibling = byId.get(siblingId);
      if (!sibling) return;

      if (!parentsOf(sibling).some((id) => parents.has(id))) {
        problems.push(
          problem(at, `${person.name} and ${sibling.name} are listed as siblings but share no parent`),
        );
      }
    });
  });

  return problems;
}
