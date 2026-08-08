import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import type { Family } from "../../family/schema";
import { AddPerson } from "./AddPerson";
import { RoutedEdge } from "./RoutedEdge";
import { JunctionNode } from "./JunctionNode";
import { Legend } from "./Legend";
import { PersonNode } from "./PersonNode";
import { toFlow } from "./toFlow";
import { UnionNode } from "./UnionNode";
import type { ViewRequest } from "./view";

// Outside the component: React Flow rebuilds everything when these change.
const nodeTypes = { person: PersonNode, union: UnionNode, junction: JunctionNode };
const edgeTypes = { routed: RoutedEdge };

/** Close enough to read a card. Only zoomed in to, never out of. */
const READABLE_ZOOM = 0.8;
const REVEAL_MS = 400;

type FamilyTreeProps = {
  family: Family | null;
  selectedId: string | null;
  /** Where the view should go next. Clicking a card is deliberately not this. */
  view: ViewRequest | null;
  onSelect: (id: string | null) => void;
  onAdd: (() => void) | null;
};

/** The provider is what lets the canvas be moved from inside it. */
export function FamilyTree(props: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({ family, selectedId, view, onSelect, onAdd }: FamilyTreeProps) {
  const flow = useReactFlow();
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

  /**
   * Answers the standing request, once the drawing can answer it.
   *
   * A person just added is joined to nobody, so the layout gives them a column
   * of their own past everything else — off screen on any document worth the
   * name. A family just loaded is a different drawing entirely under a view
   * aimed at the last one. Both are asked for before the nodes exist, so this
   * waits: a request it cannot honour is left standing and tried again on the
   * next set of nodes.
   *
   * Remembering which request was answered is what keeps the canvas still. The
   * node list is rebuilt on every keystroke, and the view must not chase it.
   */
  const answered = useRef(0);
  useEffect(() => {
    if (view === null || view.at === answered.current) return;

    // The canvas is a render behind: on the pass that asks, it still holds the
    // last drawing. So the test is whether it holds *this* one — all of it,
    // because a document keeps its first person when somebody is added to the
    // end, and that alone would pass while the new person was still missing.
    // `nodes` is in the dependencies as the thing that changes when it catches
    // up, not because the answer is read from it.
    if (marked.length === 0 || !marked.every((node) => flow.getNode(node.id))) return;

    if (view.kind === "fit") {
      answered.current = view.at;
      flow.fitView({ duration: REVEAL_MS });

      return;
    }

    const node = flow.getNode(view.id);
    if (!node) return;

    answered.current = view.at;
    flow.setCenter(
      node.position.x + (node.width ?? 0) / 2,
      node.position.y + (node.height ?? 0) / 2,
      { zoom: Math.max(flow.getZoom(), READABLE_ZOOM), duration: REVEAL_MS },
    );
  }, [view, nodes, marked, flow]);

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
      <Panel position="top-left" className="!m-3 flex flex-col items-start gap-2">
        <AddPerson onAdd={onAdd} />
        <Legend />
      </Panel>

      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
