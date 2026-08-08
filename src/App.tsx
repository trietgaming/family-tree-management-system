import { useEffect, useMemo, useRef, useState } from "react";
import { openingExample } from "./examples";
import { Document } from "./family/Document";
import { PersonId, type PersonRepository } from "./family/model";
import { YearRange } from "./family/years";
import { JsonPanel } from "./features/editor/JsonPanel";
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
  const [written, setWritten] = useState(() => Document.of(loadDocument(openingExample.text)));
  const [isPanelShown, setIsPanelShown] = useState(() => loadPanelShown(true));
  // A way of looking at the document, not part of it, so it is not kept.
  const [range, setRange] = useState(YearRange.ANY);
  const [picking, setPicking] = useState<PickTarget | null>(null);
  const [chosen, setChosen] = useState<PersonId | null>(null);
  // One or the other: a click lands on a card or on a line, never on both.
  const [lineId, setLineId] = useState<string | null>(null);
  // Separate from the selection: clicking a card should not move the canvas.
  const [view, setView] = useState<ViewRequest | null>(null);
  const reading = useMemo(() => written.read(), [written]);

  const latest = useRef(written);
  latest.current = written;

  useEffect(() => {
    const timer = setTimeout(() => saveDocument(written.text), SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [written]);

  // Closing the tab mid-sentence should not cost the sentence.
  useEffect(() => {
    const flush = () => saveDocument(latest.current.text);
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
  const [drawn, setDrawn] = useState<PersonRepository | null>(reading.ok ? reading.repo : null);
  const [read, setRead] = useState(reading);
  if (read !== reading) {
    setRead(reading);
    if (reading.ok) setDrawn(reading.repo);
  }

  /**
   * The form works on the document that parses, not the one on the canvas. A
   * document being typed into is not one to write back over, so while it is
   * broken the form steps aside and the drawing waits with it.
   */
  const repo = reading.ok ? reading.repo : null;
  const selected = chosen === null ? null : (repo?.findById(chosen) ?? null);

  /**
   * Worked out from the family on the canvas, so the fading does not flicker
   * while the document is mid-edit and not being drawn. Turned into ids here
   * because the canvas is React Flow's, and React Flow knows people by id.
   */
  const dimmed = useMemo(
    () => new Set([...range.outsiders(drawn?.all ?? [])].map((person) => person.id.value)),
    [drawn, range],
  );

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
    const clicked = id === null ? null : (repo?.findById(PersonId.of(id)) ?? null);

    if (picking === null) {
      setChosen(clicked?.id ?? null);
      setLineId(null);
      return;
    }

    if (clicked === null || selected === null || repo === null) {
      setPicking(null);
      return;
    }

    if (!repo.candidatesFor(selected).includes(clicked)) return;

    setWritten(
      picking === "spouse"
        ? written.linkSpouses(selected, clicked)
        : written.setParent(selected, picking, clicked),
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
  const revealPerson = (id: PersonId) =>
    setView((last) => ({ at: (last?.at ?? 0) + 1, kind: "reveal", id: id.value }));

  return (
    <div
      className={`grid h-screen w-screen bg-slate-50 transition-[grid-template-columns] duration-200 ease-out ${
        isPanelShown ? "grid-cols-[minmax(22rem,28rem)_1fr]" : "grid-cols-[3.25rem_1fr]"
      }`}
    >
      <JsonPanel
        value={written.text}
        problems={reading.problems}
        summary={reading.ok ? countOf(reading.repo.all.length) : ""}
        isShown={isPanelShown}
        onToggle={() => {
          const next = !isPanelShown;
          setIsPanelShown(next);
          savePanelShown(next);
        }}
        onChange={(text) => setWritten(Document.of(text))}
        onLoad={(loaded) => {
          // Another family entirely: nobody here is the person who was selected,
          // and the view is aimed at a drawing that no longer exists.
          setWritten(Document.of(loaded));
          setChosen(null);
          fitEverything();
        }}
      />

      <div className="relative min-w-0">
        <FamilyTree
          repo={drawn}
          selectedId={selected?.id.value ?? null}
          lineId={lineId}
          onLine={(id) => {
            // A line is about people, not a person, so no form opens for it.
            setLineId(id);
            setChosen(null);
            setPicking(null);
          }}
          view={view}
          dimmed={dimmed}
          range={range}
          isPicking={picking !== null}
          onSelect={chooseCard}
          onRange={setRange}
          onAdd={
            repo &&
            (() => {
              const { document: next, added } = written.addPerson();
              setWritten(next);
              setChosen(added);
              revealPerson(added);
            })
          }
        />

        {repo && selected && (
          <PersonPanel
            person={selected}
            repo={repo}
            picking={picking}
            onArm={setPicking}
            onFocus={() => revealPerson(selected.id)}
            onName={(name) => setWritten(written.setName(selected, name))}
            onBirthYear={(year) => setWritten(written.setBirthYear(selected, year))}
            onGender={(gender) => setWritten(written.setGender(selected, gender))}
            onParent={(role, parent) => setWritten(written.setParent(selected, role, parent))}
            refuseId={(to) => written.refuseId(selected, to)}
            onRename={(to) => {
              // The selection follows the person, not the name they went by.
              const renamed = written.rename(selected, to);
              if (renamed === null) return;

              setWritten(renamed);
              setChosen(to);
            }}
            onLink={(spouse) => setWritten(written.linkSpouses(selected, spouse))}
            onUnlink={(spouse) => setWritten(written.unlinkSpouses(selected, spouse))}
            onRemove={() => {
              setWritten(written.removePerson(selected));
              setChosen(null);
              setPicking(null);
            }}
            onClose={() => {
              setChosen(null);
              setPicking(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
