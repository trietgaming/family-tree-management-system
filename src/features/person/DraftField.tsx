import { useEffect, useState } from "react";
import { Field, inputStyle } from "./Field";

type DraftFieldProps = {
  label: string;
  /** What the document says now. */
  value: string;
  /** Why what has been typed cannot be written, or null when it can. */
  refuse: (draft: string) => string | null;
  onCommit: (draft: string) => void;
  isMono?: boolean;
};

/**
 * A box that keeps what was typed, rather than only what could be written.
 *
 * Most of this form writes on every keystroke and reads itself back from the
 * document. That cannot work for a value the document refuses to hold: clearing
 * the box to retype is an ordinary thing to do, and an empty name or id is not
 * a document. So the box holds the draft, only the moments it spells something
 * usable reach the document, and the rest say why they did not.
 */
export function DraftField({ label, value, refuse, onCommit, isMono }: DraftFieldProps) {
  const [draft, setDraft] = useState(value);

  // Follows the document, except while the draft is only a trim away from it —
  // otherwise a space being typed is swallowed the moment it is committed.
  useEffect(() => {
    setDraft((current) => (current.trim() === value.trim() ? current : value));
  }, [value]);

  const refusal = refuse(draft);

  return (
    <Field label={label}>
      <input
        value={draft}
        spellCheck={!isMono}
        onChange={(event) => {
          setDraft(event.target.value);
          if (refuse(event.target.value) === null) onCommit(event.target.value);
        }}
        onBlur={() => refusal !== null && setDraft(value)}
        className={`${inputStyle} ${isMono ? "font-mono" : ""} ${
          refusal === null ? "" : "border-red-400"
        }`}
      />

      {refusal !== null && <p className="mt-1 text-xs text-red-700">{refusal}</p>}
    </Field>
  );
}
