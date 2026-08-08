import type { Node, NodeProps } from "@xyflow/react";
import { TIE_DOT, type Tie } from "./palette";

export type JunctionData = {
  on: "marriage" | "descent";
  /** Everybody whose lines meet here, so the mark can follow them. */
  people?: string[];
  tie?: Tie;
};

export type JunctionNodeType = Node<JunctionData, "junction">;

const FILL = {
  marriage: "bg-slate-600",
  descent: "bg-slate-400",
};

/**
 * Marks a point where lines actually meet. Only meetings get one, so a line
 * laid across another with no dot between them is passing over, not joining.
 */
export function JunctionNode({ data }: NodeProps<JunctionNodeType>) {
  return (
    <div
      className={`h-full w-full rounded-full ${data.tie ? TIE_DOT[data.tie] : FILL[data.on]}`}
    />
  );
}
