import type { Card } from "./Card";
import { PERSON_WIDTH } from "./geometry";

/** A card and where it sits, measured from the left edge of the block holding it. */
export type Placement = { card: Card; dx: number };

type Nested = { block: Block; dx: number };

/**
 * A laid-out piece of the drawing, measured but not yet placed.
 *
 * A block knows how wide it came out and where its own card sits inside it —
 * the anchor. It holds its contents at offsets from its own left edge, so
 * nothing is written to a card until `commit` runs at the very end with the
 * real position. During the recursion nothing moves, because nothing has been
 * put anywhere yet.
 */
export class Block {
  readonly width: number;
  readonly anchor: number;

  private readonly held: Placement[];
  private readonly nested: Nested[];

  private constructor(width: number, anchor: number, held: Placement[], nested: Nested[]) {
    this.width = width;
    this.anchor = anchor;
    this.held = held;
    this.nested = nested;
  }

  static empty(): Block {
    return new Block(0, 0, [], []);
  }

  /** A single card, anchored on itself. */
  static layCard(card: Card, at: number): Block {
    return new Block(PERSON_WIDTH, at, [{ card, dx: at }], []);
  }

  /**
   * Cards already given positions relative to one another, anchored on one of
   * them. Positions may be negative; the block is shifted so it starts at zero.
   */
  static layRow(cards: Card[], at: number[], anchorOn: number): Block {
    const from = Math.min(...at) - PERSON_WIDTH / 2;
    const to = Math.max(...at) + PERSON_WIDTH / 2;

    return new Block(
      to - from,
      at[anchorOn] - from,
      cards.map((card, index) => ({ card, dx: at[index] - from })),
      [],
    );
  }

  /** Blocks already given offsets from a common left edge. */
  static layAt(parts: Nested[]): Block {
    if (parts.length === 0) return Block.empty();

    const to = Math.max(...parts.map(({ block, dx }) => dx + block.width));

    return new Block(to, parts[0].dx + parts[0].block.anchor, [], parts);
  }

  /**
   * One block above another, each keeping the horizontal position it was given.
   * Callers line them up by choosing those positions, not by any rule here.
   */
  static stackAbove(row: Block, rowAt: number, below: Block, belowAt: number): Block {
    const from = Math.min(rowAt, belowAt);
    const to = Math.max(rowAt + row.width, belowAt + below.width);

    return new Block(to - from, rowAt - from + row.anchor, [], [
      { block: row, dx: rowAt - from },
      { block: below, dx: belowAt - from },
    ]);
  }

  /**
   * The one and only write. Every card in the block lands here.
   *
   * Rounded, because the arithmetic that got here divides by two often enough
   * to land on a quarter pixel, and a card on a quarter pixel renders blurred.
   * Everything downstream reads the card back, so the whole drawing is built on
   * whole numbers from this point on.
   */
  commit(x: number): void {
    for (const { card, dx } of this.held) card.x = Math.round(x + dx);
    for (const { block, dx } of this.nested) block.commit(x + dx);
  }

  /**
   * Every card in the block and where it would land, without landing it. This
   * is what lets a caller work out where the block fits before choosing a
   * position for it.
   */
  listOffsets(): Placement[] {
    return [
      ...this.held,
      ...this.nested.flatMap(({ block, dx }) =>
        block.listOffsets().map((held) => ({ card: held.card, dx: dx + held.dx })),
      ),
    ];
  }
}
