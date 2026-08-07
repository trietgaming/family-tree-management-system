import type { Union } from "../model";
import { near } from "./geometry";
import type { Junction } from "./types";

/**
 * The meeting points of one union's lines.
 *
 * A point earns a dot when three or more segments run out of it. Two segments
 * is a corner, which needs no explaining, and anything that only looks like a
 * meeting — one union's bar laid across another's drop — never appears here at
 * all, which is what makes the absence of a dot mean something.
 */
export function junctionsFor(
  union: Union,
  jointX: number,
  lineY: number,
  busY: number | undefined,
  childXs: number[],
  couple: boolean,
): Junction[] {
  if (childXs.length === 0 || busY === undefined) return [];

  const found: Junction[] = [];

  // Where the drop leaves the line the two partners share.
  if (couple) found.push({ id: `${union.id}@marriage`, x: jointX, y: lineY, on: "marriage" });

  const left = Math.min(jointX, ...childXs);
  const right = Math.max(jointX, ...childXs);
  const stops = childXs.some((x) => near(x, jointX)) ? childXs : [...childXs, jointX];

  for (const x of stops) {
    const arms =
      Number(x > left + 0.5) +
      Number(x < right - 0.5) +
      Number(childXs.some((childX) => near(childX, x))) +
      Number(near(x, jointX));

    if (arms >= 3) found.push({ id: `${union.id}@${Math.round(x)}`, x, y: busY, on: "descent" });
  }

  return found;
}
