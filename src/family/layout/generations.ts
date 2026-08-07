import { isDeclaredUnion, parentIdsOf, type FamilyModel, type Union } from "../model";

/**
 * A child sits one row below its parents, and partners share a row.
 *
 * The two rules can contradict each other, and not only in the obvious way of
 * an ancestor marrying a descendant: any loop of parentage and marriage does
 * it. So partners are merged into groups first, and a pairing is only merged
 * when the merge leaves the parentage acyclic. What is left is a plain
 * longest-path down a graph that is known to have a bottom.
 *
 * The rows are worked out separately from the columns because a spouse who
 * married in from another lineage has to line up with their partner, not with
 * their depth inside their own tree.
 */
export function assignGenerations(model: FamilyModel): Map<string, number> {
  const groupOf = groupPartners(model);
  const graph = graphOf(model, groupOf);
  const depths = deepenGroups(graph, sortGroups(graph));

  return new Map(
    model.order.map((person) => [person.id, depths.get(groupOf.get(person.id) ?? "") ?? 0]),
  );
}

type Graph = {
  /** A group, and the groups that must sit below it. */
  after: Map<string, Set<string>>;
  /** A group, and how many groups must sit above it. */
  above: Map<string, number>;
};

/**
 * Merges partners into one group each, so a group is a row's worth of people
 * who have to line up together.
 *
 * A pairing is offered, and taken only if the parentage still has a bottom
 * afterwards. Declared marriages are offered first, so the pairing given up is
 * the one that was merely inferred from a shared child; that union is still
 * drawn, as a link between two rows rather than a line along one.
 */
function groupPartners(model: FamilyModel): Map<string, string> {
  const couples = model.unions.filter((union) => union.partnerIds.length === 2);
  const declaredFirst = [...couples].sort(
    (a, b) => Number(isDeclaredUnion(model, b)) - Number(isDeclaredUnion(model, a)),
  );

  const kept: Union[] = [];
  for (const union of declaredFirst) {
    if (!isCyclic(graphOf(model, mergeUnions(model, [...kept, union])))) kept.push(union);
  }

  return mergeUnions(model, kept);
}

/** Disjoint sets over people, joined by the given pairings. */
function mergeUnions(model: FamilyModel, unions: Union[]): Map<string, string> {
  const parent = new Map(model.order.map((person) => [person.id, person.id]));

  const rootOf = (id: string): string => {
    let root = id;
    while ((parent.get(root) ?? root) !== root) root = parent.get(root) as string;

    return root;
  };

  for (const union of unions) {
    const [a, b] = union.partnerIds.map(rootOf);
    if (a !== b) parent.set(a, b);
  }

  return new Map([...parent.keys()].map((id) => [id, rootOf(id)]));
}

/** One arrow per parent-to-child step, between the groups the two fell into. */
function graphOf(model: FamilyModel, groupOf: Map<string, string>): Graph {
  const after = new Map<string, Set<string>>();
  const above = new Map<string, number>();

  for (const group of new Set(groupOf.values())) {
    after.set(group, new Set());
    above.set(group, 0);
  }

  for (const person of model.order) {
    const child = groupOf.get(person.id);
    if (child === undefined) continue;

    for (const parentId of parentIdsOf(model, person.id)) {
      const parent = groupOf.get(parentId);
      const below = parent === undefined ? undefined : after.get(parent);
      if (!below || below.has(child)) continue;

      below.add(child);
      above.set(child, (above.get(child) ?? 0) + 1);
    }
  }

  return { after, above };
}

/**
 * Groups from the top down. A group only comes out once everything above it
 * has, so a cycle never comes out at all and the result is short.
 */
function sortGroups(graph: Graph): string[] {
  const above = new Map(graph.above);
  const ready = [...above].filter(([, count]) => count === 0).map(([group]) => group);
  const order: string[] = [];

  while (ready.length > 0) {
    const group = ready.pop() as string;
    order.push(group);

    for (const next of graph.after.get(group) ?? []) {
      const left = (above.get(next) ?? 0) - 1;
      above.set(next, left);

      if (left === 0) ready.push(next);
    }
  }

  return order;
}

function isCyclic(graph: Graph): boolean {
  return sortGroups(graph).length < graph.after.size;
}

/**
 * The longest way down to each group, which is the row it belongs on. Longest
 * rather than shortest, so a person is below *every* line of descent that
 * reaches them and no arrow is ever drawn upwards.
 */
function deepenGroups(graph: Graph, order: string[]): Map<string, number> {
  const depths = new Map(order.map((group) => [group, 0]));

  for (const group of order) {
    const depth = depths.get(group) ?? 0;

    for (const next of graph.after.get(group) ?? []) {
      depths.set(next, Math.max(depths.get(next) ?? 0, depth + 1));
    }
  }

  return depths;
}
