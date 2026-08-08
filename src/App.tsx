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
import { ANY_YEAR, findOutsideRange, type YearRange } from "./family/years";
import { JsonPanel } from "./features/editor/JsonPanel";
import { candidatesFor } from "./features/person/kin";
import { PersonPanel } from "./features/person/PersonPanel";
import type { PickTarget } from "./features/person/picking";
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
  // A way of looking at the document, not part of it, so it is not kept.
  const [range, setRange] = useState<YearRange>(ANY_YEAR);
  const [picking, setPicking] = useState<PickTarget | null>(null);
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

  // Worked out from the family on the canvas, so the fading does not flicker
  // while the document is mid-edit and not being drawn.
  const dimmed = useMemo(() => findOutsideRange(drawn?.people ?? [], range), [drawn, range]);

  /**
   * What clicking a card means.
   *
   * Ordinarily it opens that person. While a field is armed it fills that
   * field in instead, and only with somebody the field would have offered
   * anyway — the pickers leave out a person's own line for a reason, and a
   * click should not be a way around it. A refused pick stays armed; there was
   * no way to say no to it, so it has not been used up.
   */
  const chooseCard = (id: string | null) => {
    if (picking === null) {
      setSelectedId(id);
      return;
    }

    if (id === null || selected === null || family === null) {
      setPicking(null);
      return;
    }

    if (!candidatesFor(family.people, selected).some((each) => each.id === id)) return;

    setText(
      picking === "spouse"
        ? linkSpouses(text, selected.id, id)
        : setField(text, selected.id, picking, id),
    );
    setPicking(null);
  };

  // Nothing on the canvas says "not that one", so the keyboard has to.
  useEffect(() => {
    if (picking === null) return;

    const drop = (event: KeyboardEvent) => event.key === "Escape" && setPicking(null);
    window.addEventListener("keydown", drop);

    return () => window.removeEventListener("keydown", drop);
  }, [picking]);

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
          dimmed={dimmed}
          range={range}
          isPicking={picking !== null}
          onSelect={chooseCard}
          onRange={setRange}
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
            picking={picking}
            onArm={setPicking}
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
              setPicking(null);
            }}
            onClose={() => {
              setSelectedId(null);
              setPicking(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
