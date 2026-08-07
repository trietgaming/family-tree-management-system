import { makePersonId } from "./id";

/**
 * Changes to the document, made on the document as written.
 *
 * Not on the parsed family: the schema drops a key it does not know and returns
 * the ones it does in its own order, so a round trip through it would quietly
 * rewrite parts of the file nobody touched. Parsing the raw JSON keeps the keys
 * and their order, and the only thing the app imposes is the whitespace.
 */
type Written = Record<string, unknown>;

const INDENT = 2;

export type PlainField = "name" | "gender" | "birthYear" | "fatherId" | "motherId";

const ID_LISTS = ["spouseIds", "siblingIds"] as const;
const PARENT_FIELDS = ["fatherId", "motherId"] as const;

function rewrite(text: string, change: (people: Written[]) => void): string {
  const document = JSON.parse(text) as { people: Written[] };
  change(document.people);

  return `${JSON.stringify(document, null, INDENT)}\n`;
}

function personAt(people: Written[], id: string): Written | undefined {
  return people.find((person) => person.id === id);
}

function idsIn(person: Written, field: string): string[] {
  const value = person[field];
  if (!Array.isArray(value)) return [];

  return value.filter((each): each is string => typeof each === "string");
}

/** An empty list is written by not writing it, which is what absent means. */
function writeIds(person: Written, field: string, ids: string[]): void {
  if (ids.length === 0) delete person[field];
  else person[field] = ids;
}

/**
 * Clearing a field removes it rather than setting it to null: the schema treats
 * the two the same, and the shorter one is what the examples are written in.
 */
export function setField(
  text: string,
  id: string,
  field: PlainField,
  value: string | number | null,
): string {
  return rewrite(text, (people) => {
    const person = personAt(people, id);
    if (!person) return;

    if (value === null || value === "") delete person[field];
    else person[field] = value;
  });
}

/**
 * Marriage is written on both people. One side alone is only a warning away
 * from being drawn as the weaker thing, and nothing the form offers should
 * produce a document the form itself complains about.
 */
export function linkSpouses(text: string, a: string, b: string): string {
  return rewrite(text, (people) => {
    for (const [self, other] of [
      [a, b],
      [b, a],
    ]) {
      const person = personAt(people, self);
      if (!person) continue;

      const ids = idsIn(person, "spouseIds");
      if (!ids.includes(other)) writeIds(person, "spouseIds", [...ids, other]);
    }
  });
}

export function unlinkSpouses(text: string, a: string, b: string): string {
  return rewrite(text, (people) => {
    for (const [self, other] of [
      [a, b],
      [b, a],
    ]) {
      const person = personAt(people, self);
      if (!person) continue;

      writeIds(
        person,
        "spouseIds",
        idsIn(person, "spouseIds").filter((each) => each !== other),
      );
    }
  });
}

/** Appended, unnamed, and joined to nobody, which is the only blank slate there is. */
export function addPerson(text: string): { text: string; id: string } {
  const document = JSON.parse(text) as { people: Written[] };
  const id = makePersonId(new Set(document.people.map((person) => String(person.id))));

  return {
    text: rewrite(text, (people) => people.push({ id, name: "New person" })),
    id,
  };
}

/**
 * Takes the person out, and every mention of them with them.
 *
 * Children are unlinked, not removed. Deleting a grandparent should not quietly
 * delete the family below them, and "this person's father is not recorded" is
 * something the document can already say.
 */
export function removePerson(text: string, id: string): string {
  return rewrite(text, (people) => {
    const at = people.findIndex((person) => person.id === id);
    if (at !== -1) people.splice(at, 1);

    for (const person of people) {
      for (const field of PARENT_FIELDS) {
        if (person[field] === id) delete person[field];
      }

      for (const field of ID_LISTS) {
        if (person[field] === undefined) continue;

        writeIds(
          person,
          field,
          idsIn(person, field).filter((each) => each !== id),
        );
      }
    }
  });
}
