type PickButtonProps = {
  isArmed: boolean;
  /** What clicking a card would fill in, for the reader of a screen reader. */
  what: string;
  onToggle: () => void;
};

/**
 * Arms the canvas: the next card clicked fills this field in.
 *
 * A picker beside every field rather than one mode for the whole form, because
 * the thing being armed is *which* field, and a control that says so is one
 * fewer thing to remember.
 */
export function PickButton({ isArmed, what, onToggle }: PickButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isArmed}
      aria-label={isArmed ? `Stop picking ${what}` : `Pick ${what} on the canvas`}
      title={isArmed ? "Click again to stop" : "Pick from the canvas"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${
        isArmed
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="3.25" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M7 0v2.5M7 11.5V14M0 7h2.5M11.5 7H14"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
