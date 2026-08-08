/**
 * Which field the next card clicked on the canvas would fill in.
 *
 * One at a time, and null most of the time: the canvas keeps its ordinary
 * meaning — clicking somebody opens them — until a field asks for a card.
 */
export type PickTarget = "fatherId" | "motherId" | "spouse";

export const PICK_LABEL: Record<PickTarget, string> = {
  fatherId: "a father",
  motherId: "a mother",
  spouse: "a spouse",
};
