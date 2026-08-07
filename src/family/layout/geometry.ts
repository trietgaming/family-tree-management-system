export const PERSON_WIDTH = 176;
export const PERSON_HEIGHT = 68;

/**
 * Barely there on purpose. The joint is a routing point, not a mark: any width
 * here becomes a gap in the line between two spouses, which reads as a dash.
 */
export const UNION_SIZE = 2;

export const PARTNER_GAP = 32;
export const SIBLING_GAP = 56;
export const TREE_GAP = 112;
export const ROW_GAP = 96;

/** How far above the children's row the lowest bar sits, and the step between lanes. */
export const BUS_CLEARANCE = 30;
export const LANE_STEP = 18;

/** How far below the row a marriage runs when the pair cannot sit side by side. */
export const MARRIAGE_DROP = 18;

export const CARD_STEP = PERSON_WIDTH + PARTNER_GAP;

/** A stretch of the horizontal: a run of line, or the reach of a block on a row. */
export type Span = { left: number; right: number };

export function widthOf(span: Span): number {
  return span.right - span.left;
}

export function rowY(row: number): number {
  return row * (PERSON_HEIGHT + ROW_GAP);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Positions are arithmetic on halves, so equality needs a little room. */
export function isNear(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5;
}
