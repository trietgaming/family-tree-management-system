import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { useMemo, useState } from "react";
import { parseFamily } from "./family/parse";
import simpsons from "./family/simpsons.json?raw";
import { JsonPanel } from "./features/editor/JsonPanel";

export default function App() {
  const [text, setText] = useState(simpsons);
  const result = useMemo(() => parseFamily(text), [text]);

  return (
    <div className="grid h-screen w-screen grid-cols-[minmax(22rem,28rem)_1fr] bg-slate-50">
      <JsonPanel
        value={text}
        problems={result.ok ? [] : result.problems}
        summary={result.ok ? `${result.family.people.length} people` : ""}
        onChange={setText}
      />

      {/* Step 3 computes positions from the parsed family; step 4 draws them. */}
      <ReactFlow nodes={[]} edges={[]} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
