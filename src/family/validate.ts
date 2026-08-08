import type { FamilyDocument, PersonRecord } from "./schema";

export type Problem = {
  /** Where in the document, as `people[3].fatherId`. Empty for the document as a whole. */
  path: string;
  /** The same location, kept in parts so the editor can find it in the text. */
  segments: readonly PropertyKey[];
  message: string;
  /**
   * An error leaves the document meaning something the drawing cannot show —
   * a reference to nobody, a person born of themselves. A warning is data that
   * holds together well enough to draw but says something unlikely, and the
   * reader is better served by seeing the tree along with the doubt.
   */
  severity: "error" | "warning";
};

const PARENT_FIELDS = ["fatherId", "motherId"] as const;
const LINK_FIELDS = ["spouseIds", "siblingIds"] as const;

const PARENT_ROLE = { fatherId: "male", motherId: "female" } as const;
const PARENT_LABEL = { fatherId: "father", motherId: "mother" } as const;

/** Below this, a parent is young enough that the years are more likely a typo. */
const YOUNGEST_PARENT = 12;

export function formatPath(segments: readonly PropertyKey[]): string {
  return segments.reduce<string>((path, segment) => {
    if (typeof segment === "number") return `${path}[${segment}]`;

    return path ? `${path}.${String(segment)}` : String(segment);
  }, "");
}

export function errorAt(segments: readonly PropertyKey[], message: string): Problem {
  return { path: formatPath(segments), segments, message, severity: "error" };
}

export function warningAt(segments: readonly PropertyKey[], message: string): Problem {
  return { path: formatPath(segments), segments, message, severity: "warning" };
}

/**
 * Everything the schema cannot see, because it needs the whole graph rather
 * than one field at a time. An empty result means the family holds together.
 */
export function findProblems(family: FamilyDocument): Problem[] {
  const { people } = family;
  const byId = indexById(people);

  return [
    ...findDuplicateIds(people),
    ...findBrokenReferences(people, byId),
    ...findAncestryLoops(byId),
    ...findContradictorySiblings(people, byId),
    ...findMismatchedParents(people, byId),
    ...findUnlikelyYears(people, byId),
    ...findOneSidedMarriages(people, byId),
  ];
}

/** What the roles say about a parent, against what the parent's record says. */
function findMismatchedParents(people: PersonRecord[], byId: Map<string, PersonRecord>): Problem[] {
  const problems: Problem[] = [];

  people.forEach((person, index) => {
    if (person.fatherId && person.fatherId === person.motherId) {
      problems.push(
        errorAt(
          ["people", index, "motherId"],
          `${person.name} has the same person down as both parents`,
        ),
      );
    }

    for (const field of PARENT_FIELDS) {
      const parent = person[field] ? byId.get(person[field]) : undefined;
      const expected: string = PARENT_ROLE[field];

      // An unrecorded gender contradicts nothing, and "other" is not the
      // opposite of anything — only a stated opposite is worth reporting.
      if (!parent?.gender || parent.gender === expected || parent.gender === "other") continue;

      problems.push(
        warningAt(
          ["people", index, field],
          `${parent.name} is down as the ${PARENT_LABEL[field]} of ${person.name}, but recorded as ${parent.gender}`,
        ),
      );
    }
  });

  return problems;
}

function findUnlikelyYears(people: PersonRecord[], byId: Map<string, PersonRecord>): Problem[] {
  const problems: Problem[] = [];
  const thisYear = new Date().getFullYear();

  people.forEach((person, index) => {
    if (person.birthYear !== undefined && person.birthYear > thisYear) {
      problems.push(
        warningAt(["people", index, "birthYear"], `${person.name} is not born yet`),
      );
    }

    if (person.birthYear === undefined) return;

    for (const field of PARENT_FIELDS) {
      const parent = person[field] ? byId.get(person[field]) : undefined;
      if (parent?.birthYear === undefined) continue;

      const gap = person.birthYear - parent.birthYear;
      if (gap >= YOUNGEST_PARENT) continue;

      problems.push(
        warningAt(
          ["people", index, field],
          gap <= 0
            ? `${parent.name} was born in ${parent.birthYear}, not before ${person.name} in ${person.birthYear}`
            : `${parent.name} was only ${gap} when ${person.name} was born`,
        ),
      );
    }
  });

  return problems;
}

/**
 * One person naming the other as a spouse is enough to draw the pair, but the
 * line is only drawn as a marriage when both say so — so a listing that goes
 * one way quietly turns into something weaker than intended.
 */
function findOneSidedMarriages(people: PersonRecord[], byId: Map<string, PersonRecord>): Problem[] {
  const problems: Problem[] = [];

  people.forEach((person, index) => {
    person.spouseIds?.forEach((spouseId, position) => {
      const spouse = byId.get(spouseId);
      if (!spouse || spouse.id === person.id) return;
      if ((spouse.spouseIds ?? []).includes(person.id)) return;

      problems.push(
        warningAt(
          ["people", index, "spouseIds", position],
          `${person.name} names ${spouse.name} as a spouse, but not the other way round`,
        ),
      );
    });
  });

  return problems;
}

/** First occurrence wins, so every other check sees one person per id. */
function indexById(people: PersonRecord[]): Map<string, PersonRecord> {
  const byId = new Map<string, PersonRecord>();

  for (const person of people) {
    if (!byId.has(person.id)) byId.set(person.id, person);
  }

  return byId;
}

function parentIdsOf(person: PersonRecord): string[] {
  return PARENT_FIELDS.map((field) => person[field]).filter((id): id is string => Boolean(id));
}

function unknownIdMessage(id: string): string {
  return `No person has the id "${id}"`;
}

function findDuplicateIds(people: PersonRecord[]): Problem[] {
  const seen = new Set<string>();

  return people.flatMap((person, index) => {
    if (!seen.has(person.id)) {
      seen.add(person.id);
      return [];
    }

    return [errorAt(["people", index, "id"], `Duplicate id "${person.id}"`)];
  });
}

function findBrokenReferences(people: PersonRecord[], byId: Map<string, PersonRecord>): Problem[] {
  const problems: Problem[] = [];

  people.forEach((person, index) => {
    for (const field of PARENT_FIELDS) {
      const target = person[field];
      if (!target) continue;

      if (target === person.id) {
        problems.push(
          errorAt(["people", index, field], `${person.name} cannot be their own parent`),
        );
      } else if (!byId.has(target)) {
        problems.push(warningAt(["people", index, field], unknownIdMessage(target)));
      }
    }

    person.spouseIds?.forEach((target, position) => {
      if (target !== person.id) return;

      problems.push(
        errorAt(["people", index, "spouseIds", position], `${person.name} cannot marry themselves`),
      );
    });

    for (const field of LINK_FIELDS) {
      person[field]?.forEach((target, position) => {
        if (byId.has(target)) return;

        problems.push(warningAt(["people", index, field, position], unknownIdMessage(target)));
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
function findAncestryLoops(byId: Map<string, PersonRecord>): Problem[] {
  const acyclic = new Set<string>();

  for (const id of byId.keys()) {
    const loop = findLoopAbove(id, byId, [], acyclic);

    // Someone set as their own parent loops in a single step, and
    // brokenReferences already says that in plainer words.
    if (!loop || loop.length === 2) continue;

    const names = loop.map((each) => byId.get(each)?.name ?? each);

    return [errorAt(["people"], `Ancestry loops back on itself: ${names.join(" → ")}`)];
  }

  return [];
}

/**
 * Walks up through both parents and returns the chain that repeats, or null.
 * `trail` is the path taken to get here, so meeting an id already on it is the
 * loop; `acyclic` remembers who has been cleared, which keeps this linear
 * instead of re-walking every shared ancestor once per descendant.
 */
function findLoopAbove(
  id: string,
  byId: Map<string, PersonRecord>,
  trail: string[],
  acyclic: Set<string>,
): string[] | null {
  if (acyclic.has(id)) return null;

  const repeated = trail.indexOf(id);
  if (repeated !== -1) return [...trail.slice(repeated), id];

  const person = byId.get(id);
  if (!person) return null;

  for (const parentId of parentIdsOf(person)) {
    if (!byId.has(parentId)) continue;

    const loop = findLoopAbove(parentId, byId, [...trail, id], acyclic);
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
function findContradictorySiblings(people: PersonRecord[], byId: Map<string, PersonRecord>): Problem[] {
  const problems: Problem[] = [];

  people.forEach((person, index) => {
    const parents = new Set(parentIdsOf(person));

    person.siblingIds?.forEach((siblingId, position) => {
      const at = ["people", index, "siblingIds", position];

      if (siblingId === person.id) {
        problems.push(warningAt(at, `${person.name} is listed as their own sibling`));
        return;
      }

      // A dangling id is already reported by brokenReferences.
      const sibling = byId.get(siblingId);
      if (!sibling) return;

      if (!parentIdsOf(sibling).some((id) => parents.has(id))) {
        problems.push(
          warningAt(at, `${person.name} and ${sibling.name} are listed as siblings but share no parent`),
        );
      }
    });
  });

  return problems;
}
