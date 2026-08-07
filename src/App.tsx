import { useEffect, useMemo, useRef, useState } from "react";
import { openingExample } from "./examples";
import { parseFamily } from "./family/parse";
import type { Family } from "./family/schema";
import { JsonPanel } from "./features/editor/JsonPanel";
import { FamilyTree } from "./features/tree/FamilyTree";
import { loadDocument, saveDocument } from "./storage";

/**
 * Long enough that a burst of typing is one write rather than one per key,
 * short enough that it is never worth thinking about.
 */
const SAVE_DELAY = 300;

function countOf(people: number): string {
  return people === 1 ? "1 person" : `${people} people`;
}

export default function App() {
  const [text, setText] = useState(() => loadDocument(openingExample.text));
  const result = useMemo(() => parseFamily(text), [text]);

  const latest = useRef(text);
  latest.current = text;

  useEffect(() => {
    const timer = setTimeout(() => saveDocument(text), SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [text]);

  // Closing the tab mid-sentence should not cost the sentence.
  useEffect(() => {
    const flush = () => saveDocument(latest.current);
    window.addEventListener("pagehide", flush);

    return () => window.removeEventListener("pagehide", flush);
  }, []);

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
        summary={result.ok ? countOf(result.family.people.length) : ""}
        onChange={setText}
      />

      <FamilyTree family={drawn} />
    </div>
  );
}
