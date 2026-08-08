import { ANY_YEAR, isRangeSet, yearFrom, type YearRange } from "../../family/years";

type YearFilterProps = {
  range: YearRange;
  onChange: (range: YearRange) => void;
};

const box =
  "w-14 rounded border border-slate-300 px-1 py-0.5 text-center text-xs text-slate-900 outline-none focus:border-slate-500";

/**
 * Either end may be left open, so this is two boxes rather than a slider: a
 * slider has to invent both ends before it can be dragged, and "born before
 * 1900" is a question with only one.
 */
export function YearFilter({ range, onChange }: YearFilterProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">
      <span>Show people born</span>

      <span>from</span>
      <input
        type="number"
        value={range.from ?? ""}
        placeholder="yyyy"
        aria-label="Born no earlier than"
        onChange={(event) => onChange({ ...range, from: yearFrom(event.target.value) })}
        className={box}
      />
      <span>to</span>
      <input
        type="number"
        value={range.to ?? ""}
        placeholder="yyyy"
        aria-label="Born no later than"
        onChange={(event) => onChange({ ...range, to: yearFrom(event.target.value) })}
        className={box}
      />

      {isRangeSet(range) && (
        <button
          type="button"
          onClick={() => onChange(ANY_YEAR)}
          aria-label="Clear the year filter"
          title="Clear the year filter"
          className="rounded px-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ×
        </button>
      )}
    </div>
  );
}
