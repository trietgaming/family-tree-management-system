import { ancestorsOf, parentIdsOf, type FamilyModel } from "../model";

/**
 * A child sits one row below its parents, and partners share a row. Both rules
 * only ever push a row downwards, so repeating them settles rather than
 * oscillates. Cycles are refused by validation before this runs.
 *
 * The rows are worked out separately from the columns because a spouse who
 * married in from another lineage has to line up with their partner, not with
 * their depth inside their own tree.
 */
export function assignGenerations(model: FamilyModel): Map<string, number> {
  const generations = new Map(model.order.map((person) => [person.id, 0]));
  const at = (id: string) => generations.get(id) ?? 0;

  /**
   * A union between an ancestor and a descendant cannot have it both ways: one
   * of them is below the other by birth, and levelling them would then push
   * that same descendant down again, and again, until the pass limit stops it
   * on a number that means nothing. Descent wins; the marriage is drawn as a
   * link between two rows instead.
   */
  const acrossGenerations = new Set(
    model.unions
      .filter((union) => {
        if (union.partnerIds.length !== 2) return false;

        const [a, b] = union.partnerIds;

        return ancestorsOf(model, a).has(b) || ancestorsOf(model, b).has(a);
      })
      .map((union) => union.id),
  );

  for (let pass = 0; pass <= model.order.length; pass++) {
    let moved = false;

    for (const person of model.order) {
      const parents = parentIdsOf(model, person.id);
      if (parents.length === 0) continue;

      const wanted = Math.max(...parents.map(at)) + 1;
      if (wanted > at(person.id)) {
        generations.set(person.id, wanted);
        moved = true;
      }
    }

    for (const union of model.unions) {
      if (acrossGenerations.has(union.id)) continue;

      const wanted = Math.max(...union.partnerIds.map(at));

      for (const partnerId of union.partnerIds) {
        if (wanted > at(partnerId)) {
          generations.set(partnerId, wanted);
          moved = true;
        }
      }
    }

    if (!moved) break;
  }

  return generations;
}
