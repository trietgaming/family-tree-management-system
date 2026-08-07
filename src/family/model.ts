import type { Family, Person } from "./schema";

/**
 * A pairing that the diagram draws as a joint: parents connect down into it,
 * children hang off it. Family trees are not trees — a child has two parents,
 * and a parent can appear in several pairings — so this is what turns the
 * relationships into something a layered layout can place.
 */
export type Union = {
  id: string;
  /** One or two people. One when only a single parent is known. */
  partnerIds: string[];
  childIds: string[];
};

export type FamilyModel = {
  /** People in the order the document lists them, which decides ties later. */
  order: Person[];
  byId: Map<string, Person>;
  unions: Union[];
  /** Unions a person is a partner in — more than one after a remarriage. */
  unionsOf: Map<string, Union[]>;
  /** The union a person is a child of, if their parents are known. */
  bornInto: Map<string, Union>;
};

/** Prefixed because unions and people end up as node ids in the same diagram. */
function unionIdFor(partnerIds: readonly string[]): string {
  return `union:${[...partnerIds].sort().join("+")}`;
}

export function buildModel(family: Family): FamilyModel {
  const byId = new Map(family.people.map((person) => [person.id, person]));
  const unions = new Map<string, Union>();

  const ensure = (partnerIds: string[]): Union => {
    const id = unionIdFor(partnerIds);
    const existing = unions.get(id);
    if (existing) return existing;

    const union: Union = { id, partnerIds: [...partnerIds].sort(), childIds: [] };
    unions.set(id, union);

    return union;
  };

  const bornInto = new Map<string, Union>();

  // One union for every set of parents that actually produced someone. Half
  // siblings land in different unions because their parent pairs differ.
  for (const person of family.people) {
    const parents = [person.fatherId, person.motherId].filter(
      (id): id is string => id != null && byId.has(id),
    );
    if (parents.length === 0) continue;

    const union = ensure(parents);
    union.childIds.push(person.id);
    bornInto.set(person.id, union);
  }

  // And one for every couple with no children, who would otherwise have
  // nothing joining them. Marriage and parenthood are separate facts here.
  for (const person of family.people) {
    for (const spouseId of person.spouseIds ?? []) {
      if (byId.has(spouseId)) ensure([person.id, spouseId]);
    }
  }

  const unionsOf = new Map<string, Union[]>();
  for (const union of unions.values()) {
    for (const partnerId of union.partnerIds) {
      const list = unionsOf.get(partnerId);
      if (list) list.push(union);
      else unionsOf.set(partnerId, [union]);
    }
  }

  return { order: family.people, byId, unions: [...unions.values()], unionsOf, bornInto };
}

export function parentIdsOf(model: FamilyModel, personId: string): string[] {
  return model.bornInto.get(personId)?.partnerIds ?? [];
}

/** Everyone above a person in the tree. Empty when their parents are unknown. */
export function ancestorsOf(model: FamilyModel, personId: string): Set<string> {
  const found = new Set<string>();
  const pending = [...parentIdsOf(model, personId)];

  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || found.has(id)) continue;

    found.add(id);
    pending.push(...parentIdsOf(model, id));
  }

  return found;
}

export function arePartners(model: FamilyModel, a: string, b: string): boolean {
  return (model.unionsOf.get(a) ?? []).some((union) => union.partnerIds.includes(b));
}
