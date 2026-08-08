/**
 * Something for the canvas to do once the drawing has caught up.
 *
 * Both kinds have to wait. Neither the person just added nor the family just
 * loaded is on the canvas at the moment it is asked for — the nodes are only
 * there after the document has been read back and laid out.
 *
 * `at` counts requests rather than naming them, so asking for the same thing
 * twice is answered twice. Loading the example already on screen should still
 * put the view back where it started.
 */
export type ViewRequest =
  | { at: number; kind: "fit" }
  | { at: number; kind: "reveal"; id: string };
