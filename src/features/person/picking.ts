import type { ParentRole } from "../../family/model";

/**
 * Which field the next card clicked on the canvas would fill in.
 *
 * One at a time, and null most of the time: the canvas keeps its ordinary
 * meaning — clicking somebody opens them — until a field asks for a card.
 */
export type PickTarget = ParentRole | "spouse";

export const PICK_LABEL: Record<PickTarget, string> = {
  father: "a father",
  mother: "a mother",
  spouse: "a spouse",
};
