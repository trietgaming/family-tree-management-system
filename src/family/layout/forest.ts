import { mean } from "./geometry";
import { parentIdsOf, type FamilyModel } from "../model";
import type { Branch, TreeNode } from "./types";

/**
 * Turns the graph into trees by giving every person one home: the first place
 * the walk reaches them. A spouse nobody has claimed is drawn beside their
 * partner, which keeps couples together even when they come from different
 * families — the price is that the link up to their own parents is a long one.
 * That is the trade this layout makes, and it is the reason each joint can sit
 * exactly above its own children.
 */
export function buildForest(model: FamilyModel): TreeNode[] {
  const placed = new Set<string>();
  const documentOrder = new Map(model.order.map((person, index) => [person.id, index]));

  /**
   * A person with one spouse keeps the order the document gives them; a person
   * with several stands in the middle, so every joint has a partner beside it.
   */
  const rowFor = (personId: string, branches: Branch[]): string[] => {
    const spouses = branches
      .map((branch) => branch.spouseId)
      .filter((id): id is string => id !== null);

    if (spouses.length === 0) return [personId];

    if (spouses.length === 1) {
      const [spouse] = spouses;

      return (documentOrder.get(personId) ?? 0) <= (documentOrder.get(spouse) ?? 0)
        ? [personId, spouse]
        : [spouse, personId];
    }

    return [spouses[0], personId, ...spouses.slice(1)];
  };

  const build = (personId: string): TreeNode => {
    placed.add(personId);

    const branches: Branch[] = [];
    const household = [personId];
    const seen = new Set<string>();

    // A spouse brings their own other marriages into this node with them.
    for (let i = 0; i < household.length; i++) {
      for (const union of model.unionsOf.get(household[i]) ?? []) {
        if (seen.has(union.id)) continue;
        seen.add(union.id);

        const other = union.partnerIds.find((id) => id !== household[i]);
        const spouseId = other !== undefined && !placed.has(other) ? other : null;

        if (spouseId !== null) {
          placed.add(spouseId);
          household.push(spouseId);
        }

        // Claim the children before recursing, so a sibling cannot be pulled
        // away and drawn as somebody's spouse instead.
        const mine = union.childIds.filter((id) => !placed.has(id));
        for (const id of mine) placed.add(id);

        branches.push({ union, spouseId, children: mine.map(build) });
      }
    }

    return { personId, branches, row: [], width: 0 };
  };

  const roots: TreeNode[] = [];

  for (const person of model.order) {
    if (placed.has(person.id) || model.bornInto.has(person.id)) continue;
    roots.push(build(person.id));
  }

  // Anything still unplaced is disconnected from every root; give it its own.
  for (const person of model.order) {
    if (!placed.has(person.id)) roots.push(build(person.id));
  }

  orderBranches(roots, model);

  for (const root of roots) {
    const fill = (node: TreeNode) => {
      node.row = rowFor(node.personId, node.branches);
      childrenOf(node).forEach(fill);
    };
    fill(root);
  }

  return roots;
}

export function allNodes(node: TreeNode): TreeNode[] {
  return [node, ...childrenOf(node).flatMap(allNodes)];
}

export function peopleIn(node: TreeNode): string[] {
  return allNodes(node).flatMap((each) => [
    each.personId,
    ...each.branches.map((branch) => branch.spouseId).filter((id): id is string => id !== null),
  ]);
}

/**
 * Which way a branch leans, and the order that follows from it.
 *
 * A spouse drawn beside their partner keeps their own parents in whichever
 * tree those parents belong to, so the line up to them has to cross. It is at
 * its shortest when that spouse sits on the side facing the family they came
 * from — which is what sorting by lean arranges. Without it, a married-in
 * daughter can end up at the far end of her husband's family and her parents'
 * line has to reach across the whole drawing.
 */
function orderBranches(roots: TreeNode[], model: FamilyModel): void {
  const homeTree = new Map<string, number>();
  roots.forEach((root, index) => {
    for (const id of peopleIn(root)) homeTree.set(id, index);
  });

  const leanOf = (node: TreeNode, home: number): number => {
    const elsewhere = peopleIn(node)
      .flatMap((id) => parentIdsOf(model, id))
      .map((parentId) => homeTree.get(parentId))
      .filter((index): index is number => index !== undefined && index !== home);

    const average = mean(elsewhere);

    return average === null ? 0 : average - home;
  };

  roots.forEach((root, home) => {
    for (const node of allNodes(root)) {
      const lean = new Map(
        node.branches.map((branch) => [
          branch,
          mean(branch.children.map((child) => leanOf(child, home))) ?? 0,
        ]),
      );

      node.branches.sort((a, b) => (lean.get(a) ?? 0) - (lean.get(b) ?? 0));
    }
  });
}

export function childrenOf(node: TreeNode): TreeNode[] {
  return node.branches.flatMap((branch) => branch.children);
}
