import { useEffect, useMemo, useRef, useState } from "react";
import { openingExample } from "./examples";
import {
  addPerson,
  idsInUse,
  linkSpouses,
  removePerson,
  renamePersonId,
  setField,
  unlinkSpouses,
} from "./family/edit";
import { parseFamily } from "./family/parse";
import type { Family } from "./family/schema";
import { JsonPanel } from "./features/editor/JsonPanel";
import { PersonPanel } from "./features/person/PersonPanel";
import { FamilyTree } from "./features/tree/FamilyTree";
import type { ViewRequest } from "./features/tree/view";
import { loadDocument, loadPanelShown, savePanelShown, saveDocument } from "./storage";

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
  const [isPanelShown, setIsPanelShown] = useState(() => loadPanelShown(true));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Separate from the selection: clicking a card should not move the canvas.
  const [view, setView] = useState<ViewRequest | null>(null);
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

  /**
   * The last family that made sense stays on the canvas while the document is
   * mid-edit, so the drawing does not blink out between two keystrokes.
   *
   * Kept in step during the render rather than caught up in an effect. An
   * effect would leave the canvas a render behind, and a request to move the
   * view is made in the same breath as the change it is about — it would arrive
   * ahead of the drawing it means, and be answered against the one before.
   */
  const [drawn, setDrawn] = useState<Family | null>(result.ok ? result.family : null);
  const [read, setRead] = useState(result);
  if (read !== result) {
    setRead(result);
    if (result.ok) setDrawn(result.family);
  }

  /**
   * The form works on the document that parses, not the one on the canvas. A
   * document being typed into is not one to write back over, so while it is
   * broken the form steps aside and the drawing waits with it.
   */
  const family = result.ok ? result.family : null;
  const selected = family?.people.find((person) => person.id === selectedId) ?? null;

  // Read from the document rather than the family, so an id the schema threw
  // out still counts as taken. Guarded by `ok`, which is what makes it parseable.
  const taken = useMemo(() => (result.ok ? idsInUse(text) : []), [result.ok, text]);

  const fitEverything = () => setView((last) => ({ at: (last?.at ?? 0) + 1, kind: "fit" }));
  const revealPerson = (id: string) =>
    setView((last) => ({ at: (last?.at ?? 0) + 1, kind: "reveal", id }));

  return (
    <div
      className={`grid h-screen w-screen bg-slate-50 transition-[grid-template-columns] duration-200 ease-out ${
        isPanelShown ? "grid-cols-[minmax(22rem,28rem)_1fr]" : "grid-cols-[3.25rem_1fr]"
      }`}
    >
      <JsonPanel
        value={text}
        problems={result.problems}
        summary={result.ok ? countOf(result.family.people.length) : ""}
        isShown={isPanelShown}
        onToggle={() => {
          const next = !isPanelShown;
          setIsPanelShown(next);
          savePanelShown(next);
        }}
        onChange={setText}
        onLoad={(loaded) => {
          // Another family entirely: nobody here is the person who was selected,
          // and the view is aimed at a drawing that no longer exists.
          setText(loaded);
          setSelectedId(null);
          fitEverything();
        }}
      />

      <div className="relative min-w-0">
        <FamilyTree
          family={drawn}
          selectedId={selectedId}
          view={view}
          onSelect={setSelectedId}
          onAdd={
            family &&
            (() => {
              const added = addPerson(text);
              setText(added.text);
              setSelectedId(added.id);
              revealPerson(added.id);
            })
          }
        />

        {family && selected && (
          <PersonPanel
            person={selected}
            people={family.people}
            taken={taken}
            onSet={(field, value) => setText(setField(text, selected.id, field, value))}
            onRename={(to) => {
              // The selection follows the person, not the name they went by.
              const renamed = renamePersonId(text, selected.id, to);
              if (renamed === null) return;

              setText(renamed);
              setSelectedId(to.trim());
            }}
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
