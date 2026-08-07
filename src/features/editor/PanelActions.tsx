import { useEffect, useState } from "react";
import { examples } from "../../examples";

type PanelActionsProps = {
  /** What Copy puts on the clipboard. */
  value: string;
  /** Absent while the document does not parse, because there is nothing to add to. */
  onAdd: (() => void) | null;
  onLoad: (text: string) => void;
};

const LABEL = {
  idle: "Copy",
  copied: "Copied",
  refused: "Not allowed",
};

const control =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50";

export function PanelActions({ value, onAdd, onLoad }: PanelActionsProps) {
  const [state, setState] = useState<keyof typeof LABEL>("idle");

  useEffect(() => {
    if (state === "idle") return;

    const timer = setTimeout(() => setState("idle"), 1500);

    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      // Writing to the clipboard needs permission the page may not have.
      setState("refused");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/*
        An action rather than a setting: once the document has been edited it
        matches no example, so the control goes back to its prompt instead of
        claiming one of them is still selected.
      */}
      <select
        aria-label="Load an example"
        value=""
        onChange={(event) => {
          const chosen = examples.find((each) => each.id === event.target.value);
          if (chosen) onLoad(chosen.text);
        }}
        className={control}
      >
        <option value="" disabled>
          Load an example…
        </option>
        {examples.map((example) => (
          <option key={example.id} value={example.id}>
            {example.label}
          </option>
        ))}
      </select>

      <button type="button" onClick={copy} className={control}>
        {LABEL[state]}
      </button>

      <button type="button" onClick={() => onAdd?.()} disabled={onAdd === null} className={control}>
        Add person
      </button>
    </div>
  );
}
