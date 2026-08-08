import type { Mention, Person } from "../../family/model";
import { PersonSelect } from "./PersonSelect";
import { PickButton } from "./PickButton";
import { labelOf } from "./kin";
import { PICK_LABEL } from "./picking";

type SpouseListProps = {
  spouses: Mention[];
  /** Everybody who could be added, minus the ones already here. */
  candidates: Person[];
  isArmed: boolean;
  onArm: () => void;
  onLink: (person: Person) => void;
  onUnlink: (spouse: Mention) => void;
};

/**
 * A list rather than a picker, because a person can have several spouses and
 * removing one has to be as easy as adding it.
 *
 * A mention the document cannot resolve is shown by its id. It is the only
 * handle there is on it, and leaving it out would leave no way to take it off.
 */
export function SpouseList(props: SpouseListProps) {
  const { spouses, candidates, isArmed, onArm, onLink, onUnlink } = props;
  const named = spouses.map((spouse) => spouse.id.value);
  const free = candidates.filter((person) => !named.includes(person.id.value));

  return (
    <div className="space-y-1.5">
      {spouses.map((spouse) => (
        <div
          key={spouse.id.value}
          className="flex items-center justify-between rounded-md bg-slate-100 py-1 pr-1 pl-2.5"
        >
          <span className="truncate text-sm text-slate-700">
            {spouse.person === null ? spouse.id.value : labelOf(spouse.person)}
          </span>

          <button
            type="button"
            aria-label={`Remove ${spouse.person?.name ?? spouse.id.value}`}
            onClick={() => onUnlink(spouse)}
            className="rounded px-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            ×
          </button>
        </div>
      ))}

      {free.length > 0 && (
        <div className="flex items-center gap-1.5">
          <PersonSelect
            value={null}
            people={free}
            blank="Add a spouse…"
            onChange={(person) => person !== null && onLink(person)}
          />

          <PickButton isArmed={isArmed} what={PICK_LABEL.spouse} onToggle={onArm} />
        </div>
      )}
    </div>
  );
}
