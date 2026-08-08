import type { FamilyDocument } from "../schema";
import { Person } from "./Person";
import type { PersonId } from "./PersonId";
import { Union } from "./Union";

/** A pairing being collected, before it knows all its children. */
type Gathering = { partners: Person[]; children: Person[] };

/**
 * Everyone in one document, and the only place their ids are still kept.
 *
 * The indexes below are what a person's relations are read through, which is
 * why they are private: the point of the repository is that no caller ever
 * holds a map from an id to something. A caller holds a `Person` and asks it.
 *
 * Unions live here too. A pairing is defined entirely by the people standing
 * in it, so there is nothing to look it up by except them, and no second
 * collection worth keeping.
 */
export class PersonRepository {
  private readonly order: Person[];
  private readonly byId: Map<string, Person>;
  private readonly unionList: Union[];
  private readonly unionsByPerson: Map<Person, Union[]>;
  private readonly bornIntoByPerson: Map<Person, Union>;
  private childrenByPerson: Map<Person, Person[]> | null = null;

  private constructor(document: FamilyDocument) {
    this.order = document.people.map((record) => Person.of(record, this));
    this.byId = new Map(this.order.map((person) => [person.id.value, person]));

    this.unionList = this.gatherUnions();
    this.bornIntoByPerson = indexBornInto(this.unionList);
    this.unionsByPerson = indexByPartner(this.unionList);
  }

  static of(document: FamilyDocument): PersonRepository {
    return new PersonRepository(document);
  }

  findById(id: PersonId): Person | null {
    return this.byId.get(id.value) ?? null;
  }

  contains(id: PersonId): boolean {
    return this.byId.has(id.value);
  }

  /** In the order the document lists them, which decides ties in the layout. */
  get all(): Person[] {
    return this.order;
  }

  get unions(): Union[] {
    return this.unionList;
  }

  unionsOf(person: Person): Union[] {
    return this.unionsByPerson.get(person) ?? [];
  }

  bornInto(person: Person): Union | null {
    return this.bornIntoByPerson.get(person) ?? null;
  }

  childrenOf(person: Person): Person[] {
    this.childrenByPerson ??= indexChildren(this.order);

    return this.childrenByPerson.get(person) ?? [];
  }

  /**
   * One union for every set of parents that actually produced someone, then
   * one for every couple with no children, who would otherwise have nothing
   * joining them. Marriage and parenthood are separate facts here.
   *
   * Half siblings land in different unions because their parent pairs differ.
   */
  private gatherUnions(): Union[] {
    const gathered = new Map<string, Gathering>();

    const ensure = (partners: Person[]): Gathering => {
      const key = keyOf(partners);
      const existing = gathered.get(key);
      if (existing) return existing;

      const fresh: Gathering = { partners, children: [] };
      gathered.set(key, fresh);

      return fresh;
    };

    for (const person of this.order) {
      const parents = [person.father, person.mother].filter(
        (parent): parent is Person => parent !== null,
      );
      if (parents.length === 0) continue;

      ensure(parents).children.push(person);
    }

    for (const person of this.order) {
      for (const spouse of person.spouses) ensure([person, spouse]);
    }

    return [...gathered.values()].map((each) => Union.of(each.partners, each.children));
  }
}

/** Two ways of naming one pairing have to agree, and only the ids can settle it. */
function keyOf(partners: Person[]): string {
  return partners
    .map((person) => person.id.value)
    .sort()
    .join("+");
}

function indexBornInto(unions: Union[]): Map<Person, Union> {
  const found = new Map<Person, Union>();

  for (const union of unions) {
    for (const child of union.children) found.set(child, union);
  }

  return found;
}

function indexByPartner(unions: Union[]): Map<Person, Union[]> {
  const found = new Map<Person, Union[]>();

  for (const union of unions) {
    for (const partner of union.partners) {
      found.set(partner, [...(found.get(partner) ?? []), union]);
    }
  }

  return found;
}

function indexChildren(people: Person[]): Map<Person, Person[]> {
  const found = new Map<Person, Person[]>();

  for (const person of people) {
    for (const parent of [person.father, person.mother]) {
      if (parent === null) continue;

      found.set(parent, [...(found.get(parent) ?? []), person]);
    }
  }

  return found;
}
