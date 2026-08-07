import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type UnionNodeType = Node<Record<string, never>, "union">;

/**
 * The junction two parents meet at and their children hang from. It draws
 * nothing: the lines arriving from either side and leaving underneath already
 * form the T, and a marker on top of that only adds clutter.
 */
export function UnionNode(_props: NodeProps<UnionNodeType>) {
  return (
    <div className="h-full w-full">
      <Handle id="left" type="target" position={Position.Left} className="!opacity-0" />
      <Handle id="right" type="target" position={Position.Right} className="!opacity-0" />
      <Handle id="top" type="target" position={Position.Top} className="!opacity-0" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
