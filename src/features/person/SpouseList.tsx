import type { PersonRecord } from "../../family/schema";
import { PersonSelect } from "./PersonSelect";
import { PickButton } from "./PickButton";
import { labelOf } from "./kin";
import { PICK_LABEL } from "./picking";

type SpouseListProps = {
  spouseIds: string[];
  byId: Map<string, PersonRecord>;
  /** Everybody who could be added, minus the ones already here. */
  candidates: PersonRecord[];
  isArmed: boolean;
  onArm: () => void;
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
};

/**
 * A list rather than a picker, because a person can have several spouses and
 * removing one has to be as easy as adding it.
 */
export function SpouseList(props: SpouseListProps) {
  const { spouseIds, byId, candidates, isArmed, onArm, onLink, onUnlink } = props;
  const free = candidates.filter((person) => !spouseIds.includes(person.id));

  return (
    <div className="space-y-1.5">
      {spouseIds.map((id) => (
        <div
          key={id}
          className="flex items-center justify-between rounded-md bg-slate-100 py-1 pr-1 pl-2.5"
        >
          <span className="truncate text-sm text-slate-700">
            {byId.has(id) ? labelOf(byId.get(id) as PersonRecord) : id}
          </span>

          <button
            type="button"
            aria-label={`Remove ${byId.get(id)?.name ?? id}`}
            onClick={() => onUnlink(id)}
            className="rounded px-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            ×
          </button>
        </div>
      ))}

      {free.length > 0 && (
        <div className="flex items-center gap-1.5">
          <PersonSelect
            value=""
            people={free}
            blank="Add a spouse…"
            onChange={(id) => id !== null && onLink(id)}
          />

          <PickButton isArmed={isArmed} what={PICK_LABEL.spouse} onToggle={onArm} />
        </div>
      )}
    </div>
  );
}
