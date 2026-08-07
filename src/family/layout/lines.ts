import type { Union } from "../model";
import {
  BUS_CLEARANCE,
  LANE_STEP,
  MARRIAGE_DROP,
  PARTNER_GAP,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  mean,
  rowY,
} from "./geometry";
import type { Frame } from "./types";

type Span = { union: Union; left: number; right: number };

/**
 * Gives each span the lowest lane on which nothing already lies across it.
 *
 * Two horizontal runs at the same height that overlap merge into one line, and
 * the drawing then claims a relationship that is not there. Narrowest first,
 * so the local runs stay low and one reaching across the drawing rides above
 * them. `most` caps the stack where there is only so much room to use.
 */
function intoLanes(spans: Span[], most: number, place: (span: Span, lane: number) => void): void {
  const occupied: Span[][] = [];

  for (const span of [...spans].sort((a, b) => a.right - a.left - (b.right - b.left))) {
    let lane = 0;
    while (lane < most && occupied[lane]?.some((t) => span.left < t.right && t.left < span.right)) {
      lane++;
    }

    occupied[lane] = [...(occupied[lane] ?? []), span];
    place(span, lane);
  }
}

function byRow(spans: (Span & { row: number })[]): Map<number, Span[]> {
  const rows = new Map<number, Span[]>();
  for (const span of spans) rows.set(span.row, [...(rows.get(span.row) ?? []), span]);

  return rows;
}

function rowOf(union: Union, { generations }: Frame): number {
  return Math.max(...union.partnerIds.map((id) => generations.get(id) ?? 0));
}

function seatsOf(union: Union, { centres }: Frame): number[] {
  return union.partnerIds.map((id) => centres.get(id) ?? 0);
}

/** True when the two can stand next to each other with the line between them. */
export function sideBySide(union: Union, frame: Frame): boolean {
  if (union.partnerIds.length !== 2) return false;

  const rows = union.partnerIds.map((id) => frame.generations.get(id) ?? 0);
  if (rows[0] !== rows[1]) return false;

  const seats = seatsOf(union, frame);

  return Math.abs(seats[0] - seats[1]) <= PERSON_WIDTH + PARTNER_GAP + 2;
}

/**
 * Where along its own line each marriage hands over to its children.
 *
 * Two people standing together have one sensible point, the gap between them.
 * A marriage drawn below the row is already a horizontal run from one card to
 * the other, so the handover can be anywhere along it — and directly above the
 * children is the place that costs no sideways jog. Only when the children lie
 * outside the run does it settle for the nearest end.
 */
export function jointsOf(frame: Frame): Map<string, number> {
  return new Map(
    frame.model.unions.map((union) => {
      const seats = seatsOf(union, frame);
      const midpoint = mean(seats) ?? 0;

      if (sideBySide(union, frame) || union.childIds.length === 0) return [union.id, midpoint];

      const kids = union.childIds.map((id) => frame.centres.get(id) ?? 0);
      const wanted = (Math.min(...kids) + Math.max(...kids)) / 2;

      return [union.id, Math.min(Math.max(wanted, Math.min(...seats)), Math.max(...seats))];
    }),
  );
}

/** The height of each union's horizontal bar down to its children. */
export function busLanes(frame: Frame, joints: Map<string, number>): Map<string, number> {
  const buses = new Map<string, number>();

  const spans = frame.model.unions
    .filter((union) => union.childIds.length > 0)
    .map((union) => {
      const xs = [
        joints.get(union.id) ?? 0,
        ...union.childIds.map((id) => frame.centres.get(id) ?? 0),
      ];

      return { union, row: rowOf(union, frame), left: Math.min(...xs), right: Math.max(...xs) };
    });

  for (const [row, group] of byRow(spans)) {
    intoLanes(group, Number.POSITIVE_INFINITY, (span, lane) => {
      buses.set(span.union.id, rowY(row + 1) - BUS_CLEARANCE - lane * LANE_STEP);
    });
  }

  return buses;
}

/**
 * Heights for the marriages that have to run below the row. Somebody married
 * three times gets a line for each, all leaving the same card and heading the
 * same way; at one height there is no telling which wife is which.
 */
export function marriageLanes(frame: Frame): Map<string, number> {
  const lanes = new Map<string, number>();

  const spans = frame.model.unions
    .filter((union) => union.partnerIds.length === 2 && !sideBySide(union, frame))
    .map((union) => {
      const seats = seatsOf(union, frame);

      return { union, row: rowOf(union, frame), left: Math.min(...seats), right: Math.max(...seats) };
    });

  for (const [row, group] of byRow(spans)) {
    const foot = rowY(row) + PERSON_HEIGHT + MARRIAGE_DROP;
    // Room between the foot of this row and the highest bar down to children.
    const most = Math.max(0, Math.floor((rowY(row + 1) - BUS_CLEARANCE - LANE_STEP - foot) / LANE_STEP));

    intoLanes(group, most, (span, lane) => {
      lanes.set(span.union.id, foot + lane * LANE_STEP);
    });
  }

  return lanes;
}
