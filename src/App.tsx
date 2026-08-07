import { useEffect, useMemo, useState } from "react";
import { parseFamily } from "./family/parse";
import type { Family } from "./family/schema";
import simpsons from "./family/simpsons.json?raw";
import { JsonPanel } from "./features/editor/JsonPanel";
import { FamilyTree } from "./features/tree/FamilyTree";

export default function App() {
  const [text, setText] = useState(simpsons);
  const result = useMemo(() => parseFamily(text), [text]);

  // The last family that made sense stays on the canvas while the document is
  // mid-edit, so the drawing does not blink out between two keystrokes.
  const [drawn, setDrawn] = useState<Family | null>(null);
  useEffect(() => {
    if (result.ok) setDrawn(result.family);
  }, [result]);

  return (
    <div className="grid h-screen w-screen grid-cols-[minmax(22rem,28rem)_1fr] bg-slate-50">
      <JsonPanel
        value={text}
        problems={result.problems}
        summary={result.ok ? `${result.family.people.length} people` : ""}
        onChange={setText}
      />

      <FamilyTree family={drawn} />
    </div>
  );
}
