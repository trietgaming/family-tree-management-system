import { useEffect, useState } from "react";
import { idProblemOf } from "../../family/edit";
import { Field, inputStyle } from "./Field";

type IdFieldProps = {
  id: string;
  /** Every id in the document, so a clash is caught before it is written. */
  taken: string[];
  onRename: (to: string) => void;
};

/**
 * The one field that cannot be written on every keystroke.
 *
 * Clearing the box to retype is an ordinary thing to do, and an empty id is not
 * a document. So the box keeps what was typed, and only the moments it spells
 * a usable id reach the document; the rest show why they did not.
 */
export function IdField({ id, taken, onRename }: IdFieldProps) {
  const [draft, setDraft] = useState(id);

  // Follows the document, except while the draft is only a trim away from it —
  // otherwise a space being typed is swallowed the moment it is committed.
  useEffect(() => {
    setDraft((current) => (current.trim() === id ? current : id));
  }, [id]);

  const refusal = idProblemOf(taken, id, draft);

  return (
    <Field label="Id">
      <input
        value={draft}
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value);
          if (idProblemOf(taken, id, event.target.value) === null) onRename(event.target.value);
        }}
        onBlur={() => refusal !== null && setDraft(id)}
        className={`${inputStyle} font-mono ${refusal === null ? "" : "border-red-400"}`}
      />

      {refusal !== null && <p className="mt-1 text-xs text-red-700">{refusal}</p>}
    </Field>
  );
}
