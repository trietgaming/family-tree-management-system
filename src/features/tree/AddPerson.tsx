/**
 * On the canvas rather than beside the JSON, because it is where people are
 * looked at. Absent while the document does not parse: there is nothing to
 * append to until it does.
 */
export function AddPerson({ onAdd }: { onAdd: (() => void) | null }) {
  return (
    <button
      type="button"
      onClick={() => onAdd?.()}
      disabled={onAdd === null}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:text-slate-400"
    >
      + Add person
    </button>
  );
}
