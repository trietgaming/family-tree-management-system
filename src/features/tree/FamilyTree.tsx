import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { layout } from "../../family/layout";
import { buildModel } from "../../family/model";
import type { Family } from "../../family/schema";
import { BusEdge } from "./BusEdge";
import { JunctionNode } from "./JunctionNode";
import { PersonNode } from "./PersonNode";
import { UnionNode } from "./UnionNode";

// Outside the component: React Flow rebuilds everything when these change.
const nodeTypes = { person: PersonNode, union: UnionNode, junction: JunctionNode };
const edgeTypes = { bus: BusEdge };

const DOT = 7;

const DESCENT = "#94a3b8";
const MARRIAGE = "#475569";

function build(family: Family | null): { nodes: Node[]; edges: Edge[] } {
  if (!family) return { nodes: [], edges: [] };

  const model = buildModel(family);
  const drawn = layout(model);

  const nodes: Node[] = drawn.nodes.map((node) => ({
    id: node.id,
    type: node.kind,
    position: { x: node.x, y: node.y },
    // Given rather than measured: the layout already decided these, and
    // React Flow needs them before it can route an edge.
    width: node.width,
    height: node.height,
    // Positions come from the layout, so dragging one would only lie about it.
    draggable: false,
    data:
      node.kind === "person"
        ? {
            name: model.byId.get(node.id)?.name ?? node.id,
            birthYear: model.byId.get(node.id)?.birthYear,
            gender: model.byId.get(node.id)?.gender,
          }
        : {},
  }));

  // Drawn after the people so they sit on top of the lines rather than under.
  nodes.push(
    ...drawn.junctions.map((junction) => ({
      id: junction.id,
      type: "junction",
      position: { x: junction.x - DOT / 2, y: junction.y - DOT / 2 },
      width: DOT,
      height: DOT,
      draggable: false,
      selectable: false,
      focusable: false,
      data: { on: junction.on },
    })),
  );

  const edges: Edge[] = drawn.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.busY === undefined ? "straight" : "bus",
    data: { busY: edge.busY, startY: edge.startY },
    /**
     * Descent is the light backbone; a marriage is darker, so the two never
     * read as one continuous line where they meet. Dashed where the union was
     * only inferred from a shared child, which is the long-standing way of
     * saying "together" without saying "married".
     */
    style:
      edge.kind === "child"
        ? { stroke: DESCENT, strokeWidth: 1.5 }
        : {
            stroke: MARRIAGE,
            strokeWidth: 2,
            strokeDasharray: edge.declared ? undefined : "7 4",
          },
  }));

  return { nodes, edges };
}

function Key({
  stroke,
  width,
  dashed,
  children,
}: {
  stroke: string;
  width: number;
  dashed?: boolean;
  children: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="2" aria-hidden="true">
        <line
          x1="0"
          y1="1"
          x2="22"
          y2="1"
          stroke={stroke}
          strokeWidth={width}
          strokeDasharray={dashed ? "7 4" : undefined}
        />
      </svg>
      {children}
    </div>
  );
}

export function FamilyTree({ family }: { family: Family | null }) {
  const drawn = useMemo(() => build(family), [family]);

  const [nodes, setNodes, onNodesChange] = useNodesState(drawn.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(drawn.edges);

  useEffect(() => {
    setNodes(drawn.nodes);
    setEdges(drawn.edges);
  }, [drawn, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodesConnectable={false}
      minZoom={0.1}
      fitView
      proOptions={{ hideAttribution: false }}
    >
      <Panel
        position="top-left"
        className="!m-3 space-y-1.5 rounded-md border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600"
      >
        <Key stroke={MARRIAGE} width={2}>
          married
        </Key>
        <Key stroke={MARRIAGE} width={2} dashed>
          together, not married
        </Key>
        <Key stroke={DESCENT} width={1.5}>
          parent to child
        </Key>
      </Panel>

      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
