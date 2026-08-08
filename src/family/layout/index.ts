import type { PersonRepository } from "../model";
import { Chart } from "./Chart";
import type { Layout } from "./types";

export { PERSON_HEIGHT, PERSON_WIDTH, UNION_SIZE } from "./geometry";
export type { Junction, Layout, LayoutEdge, LayoutNode, Point } from "./types";

/**
 * Turns a family into a drawing.
 *
 * Rows come from descent alone. Columns come from walking the family as
 * households, each person given one home. Only then is there enough on the
 * page for the router to decide where the lines run, and which of their
 * meetings are real.
 */
export function layout(repo: PersonRepository): Layout {
  return Chart.of(repo).toLayout();
}
