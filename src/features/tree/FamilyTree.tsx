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

type FamilyTreeProps = {
  family: Family | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function FamilyTree({ family, selectedId, onSelect }: FamilyTreeProps) {
  const drawn = useMemo(() => toFlow(family), [family]);

  // Selection is ours rather than React Flow's, because the node array is
  // rebuilt whenever the document changes and its own flag would not survive.
  const marked = useMemo(
    () =>
      drawn.nodes.map((node) =>
        node.type === "person"
          ? { ...node, data: { ...node.data, isSelected: node.id === selectedId } }
          : node,
      ),
    [drawn.nodes, selectedId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(marked);
  const [edges, setEdges, onEdgesChange] = useEdgesState(drawn.edges);

  useEffect(() => {
    setNodes(marked);
    setEdges(drawn.edges);
  }, [marked, drawn.edges, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelect(node.type === "person" ? node.id : null)}
      onPaneClick={() => onSelect(null)}
      nodesConnectable={false}
      elementsSelectable={false}
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
