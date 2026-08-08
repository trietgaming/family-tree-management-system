import {
  PersonId,
  PersonRepository,
  type Mention,
  type ParentRole,
  type Person,
} from "./model";
import { familySchema, type Gender } from "./schema";
import { errorAt, findProblems, type Problem } from "./validate";

/** What a person looks like before anybody has checked: keys, in file order. */
type Written = Record<string, unknown>;

const INDENT = 2;
const ID_LISTS = ["spouseIds", "siblingIds"] as const;
const PARENT_FIELDS = ["fatherId", "motherId"] as const;

export type Reading =
  | { ok: true; repo: PersonRepository; problems: Problem[] }
  | { ok: false; problems: Problem[] };

/**
 * The family as it is written down, and every change anybody can make to it.
 *
 * Edits are made on the text rather than on the parsed family. The schema
 * drops a key it does not know and returns the ones it does in its own order,
 * so a round trip through it would quietly rewrite parts of the file nobody
 * touched. Parsing the raw JSON keeps the keys and their order, and the only
 * thing the app imposes is the whitespace.
 *
 * Every edit names a `Person` and hands back a new document. Nothing here
 * takes an id, and nothing here changes anything in place: the old document is
 * still the old document, which is what lets the canvas keep drawing the last
 * version that made sense while a broken one is being typed.
 */
export class Document {
  private readonly source: string;

  private constructor(source: string) {
    this.source = source;
  }

  static of(source: string): Document {
    return new Document(source);
  }

  get text(): string {
    return this.source;
  }

  /**
   * Three failures in a row, reported through one shape: text that is not
   * JSON, JSON that is not a family, and a family that does not hold together.
   * Warnings travel with a family that is still worth drawing.
   */
  read(): Reading {
    let json: unknown;

    try {
      json = JSON.parse(this.source);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not read the JSON";

      return { ok: false, problems: [errorAt([], message)] };
    }

    const result = familySchema.safeParse(json);
    if (!result.success) {
      return {
        ok: false,
        problems: result.error.issues.map((issue) => errorAt(issue.path, issue.message)),
      };
    }

    const problems = findProblems(result.data);

    return problems.some((each) => each.severity === "error")
      ? { ok: false, problems }
      : { ok: true, repo: PersonRepository.of(result.data), problems };
  }

  /** Every id written down, including any the schema went on to reject. */
  get idsInUse(): PersonId[] {
    return this.people().map((person) => PersonId.of(String(person.id)));
  }

  setName(person: Person, name: string): Document {
    return this.write(person, "name", name);
  }

  setBirthYear(person: Person, year: number | null): Document {
    return this.write(person, "birthYear", year);
  }

  setGender(person: Person, gender: Gender | null): Document {
    return this.write(person, "gender", gender);
  }

  setParent(person: Person, role: ParentRole, parent: Person | null): Document {
    return this.write(person, `${role}Id`, parent === null ? null : parent.id.value);
  }

  /**
   * Marriage is written on both people. One side alone is only a warning away
   * from being drawn as the weaker thing, and nothing the form offers should
   * produce a document the form itself complains about.
   */
  linkSpouses(a: Person, b: Person): Document {
    return this.rewrite((people) => {
      for (const [self, other] of facingPairs(a, b)) {
        const written = personAt(people, self);
        if (!written) continue;

        const ids = idsIn(written, "spouseIds");
        if (!ids.includes(other.id.value)) {
          writeIds(written, "spouseIds", [...ids, other.id.value]);
        }
      }
    });
  }

  /**
   * A mention rather than a person on the far side: the list can hold somebody
   * the document never had, and taking that back out is the whole reason it is
   * shown.
   */
  unlinkSpouses(person: Person, spouse: Mention): Document {
    const gone = spouse.id.value;

    return this.rewrite((people) => {
      for (const [self, other] of [
        [person.id.value, gone],
        [gone, person.id.value],
      ]) {
        const written = people.find((each) => idOf(each).value === self);
        if (!written) continue;

        writeIds(
          written,
          "spouseIds",
          idsIn(written, "spouseIds").filter((each) => each !== other),
        );
      }
    });
  }

  /** Appended, unnamed, and joined to nobody, which is the only blank slate there is. */
  addPerson(): { document: Document; added: PersonId } {
    const added = PersonId.fresh(this.idsInUse);

    return {
      document: this.rewrite((people) => people.push({ id: added.value, name: "New person" })),
      added,
    };
  }

  /**
   * Takes the person out, and every mention of them with them.
   *
   * Children are unlinked, not removed. Deleting a grandparent should not
   * quietly delete the family below them, and "this person's father is not
   * recorded" is something the document can already say.
   */
  removePerson(person: Person): Document {
    const gone = person.id.value;

    return this.rewrite((people) => {
      const at = people.findIndex((each) => idOf(each).value === gone);
      if (at !== -1) people.splice(at, 1);

      for (const written of people) {
        for (const field of PARENT_FIELDS) {
          if (written[field] === gone) delete written[field];
        }

        for (const field of ID_LISTS) {
          if (written[field] === undefined) continue;

          writeIds(
            written,
            field,
            idsIn(written, field).filter((each) => each !== gone),
          );
        }
      }
    });
  }

  /**
   * Why an id cannot be used, or null when it can. Both sides are already
   * trimmed, so two ids differing only in spaces read as the clash they are.
   */
  refuseId(person: Person, to: PersonId): string | null {
    if (to.isBlank) return "An id cannot be empty";

    const clash = this.idsInUse.some((each) => !each.equals(person.id) && each.equals(to));

    return clash ? `Another person already has the id "${to}"` : null;
  }

  /**
   * A new id for a person, carried to every mention of them.
   *
   * An id is not a field like the others: it is how the document refers to
   * somebody, so changing it means rewriting every reference in the same
   * breath. Refused rather than half applied when the result would name two
   * people the same, which is an error the document cannot recover from.
   */
  rename(person: Person, to: PersonId): Document | null {
    if (this.refuseId(person, to) !== null) return null;

    const from = person.id.value;
    const swap = (id: unknown) => (id === from ? to.value : id);

    return this.rewrite((people) => {
      for (const written of people) {
        written.id = swap(written.id);

        for (const field of PARENT_FIELDS) {
          if (written[field] !== undefined) written[field] = swap(written[field]);
        }

        for (const field of ID_LISTS) {
          if (written[field] === undefined) continue;

          writeIds(written, field, idsIn(written, field).map(swap) as string[]);
        }
      }
    });
  }

  private people(): Written[] {
    return (JSON.parse(this.source) as { people: Written[] }).people;
  }

  private rewrite(change: (people: Written[]) => void): Document {
    const parsed = JSON.parse(this.source) as { people: Written[] };
    change(parsed.people);

    return Document.of(`${JSON.stringify(parsed, null, INDENT)}\n`);
  }

  /**
   * Clearing a field removes it rather than setting it to null: the schema
   * treats the two the same, and the shorter one is what the examples are
   * written in.
   */
  private write(person: Person, field: string, value: string | number | null): Document {
    return this.rewrite((people) => {
      const written = personAt(people, person);
      if (!written) return;

      if (value === null || value === "") delete written[field];
      else written[field] = value;
    });
  }
}

/** Both ways round, because the two sides of a marriage are written separately. */
function facingPairs(a: Person, b: Person): [Person, Person][] {
  return [
    [a, b],
    [b, a],
  ];
}

function idOf(written: Written): PersonId {
  return PersonId.of(String(written.id));
}

function personAt(people: Written[], person: Person): Written | undefined {
  return people.find((each) => idOf(each).equals(person.id));
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
