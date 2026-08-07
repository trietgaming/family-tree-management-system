import type { FamilyModel } from "../model";
import { spreadForest } from "./arrange";
import { assemble } from "./assemble";
import { buildForest } from "./forest";
import { assignGenerations } from "./generations";
import { busLanes, jointsOf, marriageLanes } from "./lines";
import type { Frame, Layout } from "./types";

export { PERSON_HEIGHT, PERSON_WIDTH, UNION_SIZE } from "./geometry";
export type { Junction, Layout, LayoutEdge, LayoutNode, Side } from "./types";

/**
 * Turns a family into a drawing, in stages.
 *
 * Rows come from descent alone. Columns come from walking the family as trees
 * — each person given one home, so the placement is a plain tree walk with
 * nothing to reconcile afterwards. Only then is there enough on the page to
 * decide where the lines run, and which of their meetings are real.
 */
export function layout(model: FamilyModel): Layout {
  const generations = assignGenerations(model);
  const centres = spreadForest(buildForest(model));

  const frame: Frame = { model, generations, centres };
  const joints = jointsOf(frame);

  return assemble(frame, {
    joints,
    buses: busLanes(frame, joints),
    marriages: marriageLanes(frame),
  });
}
