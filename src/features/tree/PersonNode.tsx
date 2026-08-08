import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { TIE_FRAME, type Tie } from "./palette";

export type PersonData = {
  name: string;
  birthYear?: number;
  gender?: "male" | "female" | "other";
  isSelected?: boolean;
  /** How this person is joined to whatever was clicked, if they are. */
  tie?: Tie;
  /** A field is waiting for a card, so clicking this one fills it in. */
  isPicking?: boolean;
};

/**
 * The one clicked, then the ones it is joined to, then everybody else.
 *
 * The clicked card stands up off the page as well as changing colour, so it is
 * never the hue alone that tells it from the people it reaches.
 */
function frameOf(data: PersonData): string {
  if (data.isSelected) {
    return "scale-[1.06] border-blue-600 shadow-lg ring-2 ring-blue-500/30";
  }

  return data.tie ? TIE_FRAME[data.tie] : "border-slate-300";
}

export type PersonNodeType = Node<PersonData, "person">;

const ACCENT: Record<string, string> = {
  male: "bg-blue-400",
  female: "bg-pink-400",
  other: "bg-violet-400",
};

export function PersonNode({ data }: NodeProps<PersonNodeType>) {
  return (
    <div
      className={`flex h-full w-full overflow-hidden rounded-lg border bg-white transition-transform ${
        data.isPicking ? "cursor-crosshair" : "cursor-pointer"
      } ${frameOf(data)}`}
    >
      <div className={`w-1 shrink-0 ${ACCENT[data.gender ?? ""] ?? "bg-slate-300"}`} />

      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="truncate text-sm font-medium text-slate-900">{data.name}</p>
        <p className="text-xs text-slate-500">{data.birthYear ?? "year unknown"}</p>
      </div>

      {/* The router decides where a line runs, so these only exist because
          React Flow wants an edge to name two of them. */}
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
