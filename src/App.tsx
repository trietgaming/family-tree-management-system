import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";

// Placeholders. Step 3 replaces these with positions the layout computes from
// the family model.
const initialNodes: Node[] = [
  { id: "homer", position: { x: 0, y: 0 }, data: { label: "Homer" } },
  { id: "bart", position: { x: 0, y: 140 }, data: { label: "Bart" } },
];

const initialEdges: Edge[] = [{ id: "homer-bart", source: "homer", target: "bart" }];

export default function App() {
  // React Flow reports the size it measured for each node through onNodesChange.
  // Without somewhere to put that, it cannot place an edge or fit the view.
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="h-screen w-screen bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
