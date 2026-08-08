/** Descent is the light backbone; a marriage is darker, so where the two meet
 *  they never read as one continuous line. */
export const DESCENT = "#94a3b8";
export const MARRIAGE = "#475569";

export const DOT = 7;

/**
 * How somebody lit up is joined to the person clicked.
 *
 * Three ties, three colours, so the highlight says which way the relationship
 * goes rather than only that there is one. A colour rather than more weight:
 * every other line is a grey, so a hue carries on its own, and a thicker line
 * among thin ones reads as heavy before it reads as chosen.
 */
export type Tie = "parent" | "child" | "partner";

/** Up, down, and across. Purple is the one hue a card's own colours leave free. */
export const TIE_LINE: Record<Tie, string> = {
  parent: "#ea580c",
  child: "#16a34a",
  partner: "#9333ea",
};

export const TIE_FRAME: Record<Tie, string> = {
  parent: "border-orange-500 ring-1 ring-orange-500/20",
  child: "border-green-500 ring-1 ring-green-500/20",
  partner: "border-purple-500 ring-1 ring-purple-500/20",
};

export const TIE_DOT: Record<Tie, string> = {
  parent: "bg-orange-500",
  child: "bg-green-500",
  partner: "bg-purple-500",
};

/** For naming a tie in words, where the drawing names it in lines. */
export const TIE_TEXT: Record<Tie, string> = {
  parent: "text-orange-600",
  child: "text-green-600",
  partner: "text-purple-600",
};

/** Birth before marriage, the way the rows are worked out. */
const CLOSENESS: Record<Tie, number> = { parent: 0, child: 1, partner: 2 };

/** The strongest tie of several, for a mark that stands for more than one. */
export function closestOf(ties: Tie[]): Tie | undefined {
  return [...ties].sort((a, b) => CLOSENESS[a] - CLOSENESS[b])[0];
}

export function isCloser(tie: Tie, than: Tie): boolean {
  return CLOSENESS[tie] < CLOSENESS[than];
}

/** Faint enough to fall back, solid enough to still read as part of the tree. */
export const DIM = 0.2;
export const DASH = "7 4";
