import type { Node, NodeProps } from "@xyflow/react";

export type JunctionData = { on: "marriage" | "descent" };
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
  return <div className={`h-full w-full rounded-full ${FILL[data.on]}`} />;
}
