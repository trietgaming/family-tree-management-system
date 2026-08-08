import type { Person, PersonRepository, Union } from "../model";

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
export class Generations {
  private readonly rows: Map<Person, number>;

  private constructor(rows: Map<Person, number>) {
    this.rows = rows;
  }

  static of(repo: PersonRepository): Generations {
    const grouping = groupPartners(repo);
    const graph = GroupGraph.of(repo, grouping);
    const depths = graph.depths();

    const rowOf = (person: Person): number => {
      const group = grouping.of(person);

      return group === undefined ? 0 : (depths.get(group) ?? 0);
    };

    return new Generations(new Map(repo.all.map((person) => [person, rowOf(person)])));
  }

  rowOf(person: Person): number {
    return this.rows.get(person) ?? 0;
  }
}

/**
 * A row's worth of people who have to line up together, as one thing that can
 * be merged with another.
 *
 * Disjoint sets, but held as links between the groups themselves rather than
 * as a table of names pointing at names — merging is then something two groups
 * do to each other, and there is nothing to look up.
 */
class PartnerGroup {
  private up: PartnerGroup | null = null;

  private constructor() {}

  static alone(): PartnerGroup {
    return new PartnerGroup();
  }

  get root(): PartnerGroup {
    return this.up === null ? this : this.up.root;
  }

  absorb(other: PartnerGroup): void {
    const mine = this.root;
    const theirs = other.root;

    if (mine !== theirs) mine.up = theirs;
  }
}

/** Which group each person ended up in, once the merging has settled. */
class Grouping {
  private readonly groups: Map<Person, PartnerGroup>;

  private constructor(groups: Map<Person, PartnerGroup>) {
    this.groups = groups;
  }

  static from(repo: PersonRepository, unions: Union[]): Grouping {
    const own = new Map(repo.all.map((person) => [person, PartnerGroup.alone()]));

    for (const union of unions) {
      const [a, b] = union.partners.map((person) => own.get(person));
      if (a && b) a.absorb(b);
    }

    return new Grouping(new Map([...own].map(([person, group]) => [person, group.root])));
  }

  of(person: Person): PartnerGroup | undefined {
    return this.groups.get(person);
  }

  get all(): PartnerGroup[] {
    return [...new Set(this.groups.values())];
  }
}

/**
 * Merges partners into one group each.
 *
 * A pairing is offered, and taken only if the parentage still has a bottom
 * afterwards. Declared marriages are offered first, so the pairing given up is
 * the one that was merely inferred from a shared child; that union is still
 * drawn, as a link between two rows rather than a line along one.
 */
function groupPartners(repo: PersonRepository): Grouping {
  const couples = repo.unions.filter((union) => union.isCouple);
  const declaredFirst = [...couples].sort(
    (a, b) => Number(b.isDeclared) - Number(a.isDeclared),
  );

  const kept: Union[] = [];
  for (const union of declaredFirst) {
    const offered = Grouping.from(repo, [...kept, union]);
    if (!GroupGraph.of(repo, offered).isCyclic) kept.push(union);
  }

  return Grouping.from(repo, kept);
}

/** One arrow per parent-to-child step, between the groups the two fell into. */
class GroupGraph {
  private readonly after: Map<PartnerGroup, Set<PartnerGroup>>;
  private readonly above: Map<PartnerGroup, number>;

  private constructor(
    after: Map<PartnerGroup, Set<PartnerGroup>>,
    above: Map<PartnerGroup, number>,
  ) {
    this.after = after;
    this.above = above;
  }

  static of(repo: PersonRepository, grouping: Grouping): GroupGraph {
    const after = new Map<PartnerGroup, Set<PartnerGroup>>();
    const above = new Map<PartnerGroup, number>();

    for (const group of grouping.all) {
      after.set(group, new Set());
      above.set(group, 0);
    }

    for (const person of repo.all) {
      const child = grouping.of(person);
      if (child === undefined) continue;

      for (const parent of person.parents) {
        const overhead = grouping.of(parent);
        const below = overhead === undefined ? undefined : after.get(overhead);
        if (!below || below.has(child)) continue;

        below.add(child);
        above.set(child, (above.get(child) ?? 0) + 1);
      }
    }

    return new GroupGraph(after, above);
  }

  /**
   * Groups from the top down. A group only comes out once everything above it
   * has, so a cycle never comes out at all and the result is short.
   */
  private sorted(): PartnerGroup[] {
    const left = new Map(this.above);
    const ready = [...left].filter(([, count]) => count === 0).map(([group]) => group);
    const order: PartnerGroup[] = [];

    while (ready.length > 0) {
      const group = ready.pop() as PartnerGroup;
      order.push(group);

      for (const next of this.after.get(group) ?? []) {
        const remaining = (left.get(next) ?? 0) - 1;
        left.set(next, remaining);

        if (remaining === 0) ready.push(next);
      }
    }

    return order;
  }

  get isCyclic(): boolean {
    return this.sorted().length < this.after.size;
  }

  /**
   * The longest way down to each group, which is the row it belongs on. Longest
   * rather than shortest, so a person is below *every* line of descent that
   * reaches them and no arrow is ever drawn upwards.
   */
  depths(): Map<PartnerGroup, number> {
    const order = this.sorted();
    const depths = new Map(order.map((group) => [group, 0]));

    for (const group of order) {
      const depth = depths.get(group) ?? 0;

      for (const next of this.after.get(group) ?? []) {
        depths.set(next, Math.max(depths.get(next) ?? 0, depth + 1));
      }
    }

    return depths;
  }
}
