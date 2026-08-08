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
  type Edge,
} from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import type { PersonRepository } from "../../family/model";
import type { YearRange } from "../../family/years";
import { AddPerson } from "./AddPerson";
import { RoutedEdge } from "./RoutedEdge";
import { JunctionNode } from "./JunctionNode";
import { Legend } from "./Legend";
import { DIM, TIE_LINE, closestOf, isCloser, type Tie } from "./palette";
import { PersonNode } from "./PersonNode";
import { toFlow } from "./toFlow";
import { UnionNode } from "./UnionNode";
import type { ViewRequest } from "./view";
import { YearFilter } from "./YearFilter";

// Outside the component: React Flow rebuilds everything when these change.
const nodeTypes = { person: PersonNode, union: UnionNode, junction: JunctionNode };
const edgeTypes = { routed: RoutedEdge };

/** Close enough to read a card. Only zoomed in to, never out of. */
const READABLE_ZOOM = 0.8;
const REVEAL_MS = 400;

/** Above the other cards, and above the marks that are drawn after them. */
const ON_TOP = 10;

function isFaded(about: string[], dimmed: ReadonlySet<string>): boolean {
  return about.length > 0 && about.every((id) => dimmed.has(id));
}

function peopleOn(edge: Edge): string[] {
  return (edge.data?.people ?? []) as string[];
}

type Ties = { lines: Map<string, Tie>; people: Map<string, Tie> };

function kindOf(edge: Edge): "marriage" | "child" {
  return edge.data?.kind === "marriage" ? "marriage" : "child";
}

/**
 * How everything on the drawing is joined to the thing clicked.
 *
 * A person is on exactly the lines naming them: their marriages, their lines
 * down to their children, and the one their parents reach them by. A line to a
 * sibling names the sibling and not them, so it stays grey.
 *
 * Which way each line goes is read from the line itself. A descent line ending
 * at them is the one their parents came down; any other is one of theirs going
 * down to a child. The people on a line do not all share its tie — a line down
 * to a child also names the other parent, who is a partner and coloured as one.
 *
 * A line clicked on its own has no side to be read from, so it and everybody on
 * it take the single colour of what the line is.
 */
function findTies(edges: Edge[], personId: string | null, lineId: string | null): Ties {
  const lines = new Map<string, Tie>();
  const people = new Map<string, Tie>();

  const note = (id: string, tie: Tie) => {
    const had = people.get(id);
    if (had === undefined || isCloser(tie, had)) people.set(id, tie);
  };

  if (personId === null) {
    const edge = edges.find((each) => each.id === lineId);
    if (!edge) return { lines, people };

    const tie = kindOf(edge) === "marriage" ? "partner" : "child";
    lines.set(edge.id, tie);
    for (const id of peopleOn(edge)) note(id, tie);

    return { lines, people };
  }

  for (const edge of edges) {
    const named = peopleOn(edge);
    if (!named.includes(personId)) continue;

    const tie: Tie =
      kindOf(edge) === "marriage" ? "partner" : edge.target === personId ? "parent" : "child";

    lines.set(edge.id, tie);

    for (const id of named) {
      if (id === personId) continue;

      // On a line down to a child, only the child is the child.
      note(id, tie === "child" && id !== edge.target ? "partner" : tie);
    }
  }

  return { lines, people };
}

/** A mark stands for several people at once, so it takes their closest tie. */
function tieOfMark(about: string[], ties: Ties, selectedId: string | null): Tie | undefined {
  if (about.length === 0) return undefined;

  const found: Tie[] = [];
  for (const id of about) {
    if (id === selectedId) continue;

    const tie = ties.people.get(id);
    if (tie === undefined) return undefined;

    found.push(tie);
  }

  return closestOf(found);
}

type FamilyTreeProps = {
  repo: PersonRepository | null;
  selectedId: string | null;
  /** Where the view should go next. Clicking a card is deliberately not this. */
  view: ViewRequest | null;
  /** The line clicked on, if the last thing clicked was a line and not a card. */
  lineId: string | null;
  onLine: (id: string | null) => void;
  /** Everybody the year filter pushes into the background. */
  dimmed: ReadonlySet<string>;
  range: YearRange;
  /** A field is waiting for a card, so the next click means something else. */
  isPicking: boolean;
  onSelect: (id: string | null) => void;
  onAdd: (() => void) | null;
  onRange: (range: YearRange) => void;
};

/** The provider is what lets the canvas be moved from inside it. */
export function FamilyTree(props: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas(props: FamilyTreeProps) {
  const { repo, selectedId, lineId, view, dimmed, range, isPicking } = props;
  const { onSelect, onLine, onAdd, onRange } = props;
  const flow = useReactFlow();
  const drawn = useMemo(() => toFlow(repo), [repo]);

  /**
   * Selection and dimming, applied over the drawing rather than inside it.
   *
   * The layout is memoised on the family alone, so neither of these makes it
   * run again. Selection is ours rather than React Flow's, because the node
   * array is rebuilt whenever the document changes and its own flag would not
   * survive.
   *
   * A mark is dimmed when *everybody* it is about is outside the range. A line
   * or a dot leading to somebody still in it is still worth following, so it
   * stays.
   */
  const ties = useMemo(
    () => findTies(drawn.edges, selectedId, lineId),
    [drawn.edges, selectedId, lineId],
  );

  const marked = useMemo(
    () =>
      drawn.nodes.map((node) => {
        const about = node.type === "person" ? [node.id] : ((node.data.people ?? []) as string[]);
        const style = isFaded(about, dimmed) ? { opacity: DIM } : undefined;

        if (node.type === "person") {
          const isSelected = node.id === selectedId;
          const data = { ...node.data, isSelected, tie: ties.people.get(node.id), isPicking };

          // The chosen card grows, and what it grows over must be underneath it.
          return { ...node, style, data, zIndex: isSelected ? ON_TOP : undefined };
        }

        return { ...node, style, data: { ...node.data, tie: tieOfMark(about, ties, selectedId) } };
      }),
    [drawn.nodes, selectedId, dimmed, isPicking, ties],
  );

  // Lit ones last, because an edge is drawn in the order it is given.
  const faded = useMemo(() => {
    const dressed = drawn.edges.map((edge) => {
      const faint = isFaded(peopleOn(edge), dimmed);
      const tie = ties.lines.get(edge.id);
      if (!faint && tie === undefined) return edge;

      const style = { ...edge.style };
      if (faint) style.opacity = DIM;
      if (tie !== undefined) style.stroke = TIE_LINE[tie];

      return { ...edge, style };
    });

    return [
      ...dressed.filter((edge) => !ties.lines.has(edge.id)),
      ...dressed.filter((edge) => ties.lines.has(edge.id)),
    ];
  }, [drawn.edges, dimmed, ties]);

  const [nodes, setNodes, onNodesChange] = useNodesState(marked);
  const [edges, setEdges, onEdgesChange] = useEdgesState(faded);

  useEffect(() => {
    setNodes(marked);
    setEdges(faded);
  }, [marked, faded, setNodes, setEdges]);

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
      // A line is not somebody, so it never answers a field waiting for a card.
      onEdgeClick={(_, edge) => !isPicking && onLine(edge.id)}
      onPaneClick={() => onSelect(null)}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.1}
      fitView
    >
      <Panel position="top-left" className="!m-3 flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <AddPerson onAdd={onAdd} />
          <YearFilter range={range} onChange={onRange} />
        </div>

        <Legend />
      </Panel>

      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
