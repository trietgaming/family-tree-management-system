import { Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import { useEffect, useMemo } from "react";
import type { Family } from "../../family/schema";
import { RoutedEdge } from "./RoutedEdge";
import { JunctionNode } from "./JunctionNode";
import { Legend } from "./Legend";
import { PersonNode } from "./PersonNode";
import { toFlow } from "./toFlow";
import { UnionNode } from "./UnionNode";

// Outside the component: React Flow rebuilds everything when these change.
const nodeTypes = { person: PersonNode, union: UnionNode, junction: JunctionNode };
const edgeTypes = { routed: RoutedEdge };

export function FamilyTree({ family }: { family: Family | null }) {
  const drawn = useMemo(() => toFlow(family), [family]);

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
    >
      <Legend />
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
