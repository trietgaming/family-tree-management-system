import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type PersonData = {
  name: string;
  birthYear?: number;
  gender?: "male" | "female" | "other";
};

export type PersonNodeType = Node<PersonData, "person">;

const ACCENT: Record<string, string> = {
  male: "bg-blue-400",
  female: "bg-pink-400",
  other: "bg-violet-400",
};

export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  return (
    <div
      className={`flex h-full w-full overflow-hidden rounded-lg border bg-white ${
        selected ? "border-slate-900" : "border-slate-300"
      }`}
    >
      <div className={`w-1 shrink-0 ${ACCENT[data.gender ?? ""] ?? "bg-slate-300"}`} />

      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="truncate text-sm font-medium text-slate-900">{data.name}</p>
        <p className="text-xs text-slate-500">{data.birthYear ?? "year unknown"}</p>
      </div>

      {/* A card can be the left partner in one marriage and the right in
          another, so each side needs both an outgoing and an incoming point. */}
      <Handle id="top" type="target" position={Position.Top} className="!opacity-0" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle id="left" type="source" position={Position.Left} className="!opacity-0" />
      <Handle id="left-in" type="target" position={Position.Left} className="!opacity-0" />
      <Handle id="right" type="source" position={Position.Right} className="!opacity-0" />
      <Handle id="right-in" type="target" position={Position.Right} className="!opacity-0" />
    </div>
  );
}
