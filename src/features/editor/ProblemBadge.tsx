import type { Problem } from "../../family/validate";

function tally(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

/**
 * All that is left of the problem list once the panel is closed.
 *
 * It says that something is wrong and how much, not what — the reading is in
 * the list, and the badge is the way back to it. Errors count on their own
 * rather than among the warnings: one of them stops the drawing, and a number
 * that mixes the two would hide that.
 */
export function ProblemBadge({ problems, onOpen }: { problems: Problem[]; onOpen: () => void }) {
  if (problems.length === 0) return null;

  const errors = problems.filter((each) => each.severity === "error").length;
  const count = errors > 0 ? errors : problems.length;
  const label = errors > 0 ? tally(errors, "error") : tally(problems.length, "warning");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}. Show the JSON`}
      title={`${label} — show the JSON`}
      className={`flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full text-xs font-semibold transition hover:brightness-95 ${
        errors > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {count > 9 ? "9+" : count}
    </button>
  );
}
