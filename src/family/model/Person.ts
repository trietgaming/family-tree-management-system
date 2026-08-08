import type { Gender, PersonRecord } from "../schema";
import { Mention } from "./Mention";
import { PersonId } from "./PersonId";
import type { PersonRepository } from "./PersonRepository";
import type { Union } from "./Union";

/** The two named parents. A role rather than a field name, so nothing spells "fatherId". */
export type ParentRole = "father" | "mother";

/**
 * Somebody in the family, as the rest of the program should know them.
 *
 * A person holds the repository they came from, so a relation is asked for
 * rather than looked up: `person.father` instead of finding a map, reading an
 * id out of a record, and hoping the id is in the map. The record stays
 * private — it is the only place ids still live, and letting it out would put
 * them back into circulation.
 *
 * Relations are resolved on the way out rather than wired in at construction.
 * They stay honest that way: the repository is finished being built long
 * before anybody asks, and nothing here has to be kept in step with it.
 */
export class Person {
  private readonly record: PersonRecord;
  private readonly repo: PersonRepository;
  private readonly identity: PersonId;

  private constructor(record: PersonRecord, repo: PersonRepository) {
    this.record = record;
    this.repo = repo;
    this.identity = PersonId.of(record.id);
  }

  /** Called by the repository and nowhere else — a person outside one has no relations. */
  static of(record: PersonRecord, repo: PersonRepository): Person {
    return new Person(record, repo);
  }

  get id(): PersonId {
    return this.identity;
  }

  get name(): string {
    return this.record.name;
  }

  get gender(): Gender | undefined {
    return this.record.gender;
  }

  get birthYear(): number | undefined {
    return this.record.birthYear;
  }

  get father(): Person | null {
    return this.lookUp(this.record.fatherId);
  }

  get mother(): Person | null {
    return this.lookUp(this.record.motherId);
  }

  /**
   * Read off the union rather than off the two fields, so a parent the
   * document names but does not contain is already gone.
   */
  get parents(): Person[] {
    return this.bornInto?.partners ?? [];
  }

  parentAs(role: ParentRole): Person | null {
    return role === "father" ? this.father : this.mother;
  }

  get children(): Person[] {
    return this.repo.childrenOf(this);
  }

  /**
   * Everyone below this person.
   *
   * The parent pickers leave these out. Choosing one would make the person
   * their own ancestor, which is an error rather than a warning — the drawing
   * would stop at the last document that held together, and a picker that can
   * freeze the page is a picker offering the wrong thing.
   */
  get descendants(): Person[] {
    return this.repo.descendantsOf(this);
  }

  /** Everyone this person names as a spouse, including any the document lacks. */
  get spouseMentions(): Mention[] {
    return (this.record.spouseIds ?? []).map((id) => {
      const settled = PersonId.of(id);

      return Mention.of(settled, this.repo.findById(settled));
    });
  }

  /** Those this person names and the document has. Naming is not mutual until both do it. */
  get spouses(): Person[] {
    return this.spouseMentions
      .map((mention) => mention.person)
      .filter((person): person is Person => person !== null);
  }

  /** Every pairing this person stands in, which is more than one after a remarriage. */
  get unions(): Union[] {
    return this.repo.unionsOf(this);
  }

  get bornInto(): Union | null {
    return this.repo.bornInto(this);
  }

  isPartnerOf(other: Person): boolean {
    return this.unions.some((union) => union.has(other));
  }

  /**
   * Both named each other, rather than merely sharing a child. The weaker sort
   * is drawn dashed, and is the one given up first when two pairings cannot
   * both hold — saying "they had a child" claims less than saying "they
   * married".
   */
  isDeclaredPartnerOf(other: Person): boolean {
    return this.namesAsSpouse(other) && other.namesAsSpouse(this);
  }

  private namesAsSpouse(other: Person): boolean {
    return (this.record.spouseIds ?? []).includes(other.id.value);
  }

  /** A field the document left empty names nobody, which is not the same as naming a stranger. */
  private lookUp(id: string | null | undefined): Person | null {
    return id == null ? null : this.repo.findById(PersonId.of(id));
  }
}
