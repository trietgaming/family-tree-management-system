import { useEffect, useMemo, useRef, useState } from "react";
import { openingExample } from "./examples";
import { addPerson, linkSpouses, removePerson, setField, unlinkSpouses } from "./family/edit";
import { parseFamily } from "./family/parse";
import type { Family } from "./family/schema";
import { JsonPanel } from "./features/editor/JsonPanel";
import { PersonPanel } from "./features/person/PersonPanel";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  /**
   * The form works on the document that parses, not the one on the canvas. A
   * document being typed into is not one to write back over, so while it is
   * broken the form steps aside and the drawing waits with it.
   */
  const family = result.ok ? result.family : null;
  const selected = family?.people.find((person) => person.id === selectedId) ?? null;

  return (
    <div className="grid h-screen w-screen grid-cols-[minmax(22rem,28rem)_1fr] bg-slate-50">
      <JsonPanel
        value={text}
        problems={result.problems}
        summary={result.ok ? countOf(result.family.people.length) : ""}
        onAdd={
          family &&
          (() => {
            const added = addPerson(text);
            setText(added.text);
            setSelectedId(added.id);
          })
        }
        onChange={setText}
      />

      <div className="relative min-w-0">
        <FamilyTree family={drawn} selectedId={selectedId} onSelect={setSelectedId} />

        {family && selected && (
          <PersonPanel
            person={selected}
            people={family.people}
            onSet={(field, value) => setText(setField(text, selected.id, field, value))}
            onLink={(spouseId) => setText(linkSpouses(text, selected.id, spouseId))}
            onUnlink={(spouseId) => setText(unlinkSpouses(text, selected.id, spouseId))}
            onRemove={() => {
              setText(removePerson(text, selected.id));
              setSelectedId(null);
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
