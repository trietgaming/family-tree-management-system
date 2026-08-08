import type { PlainField } from "../../family/edit";
import type { Person } from "../../family/schema";
import { yearFrom } from "../../family/years";
import { Field, inputStyle } from "./Field";
import { IdField } from "./IdField";
import { PersonSelect } from "./PersonSelect";
import { PickButton } from "./PickButton";
import { SpouseList } from "./SpouseList";
import { candidatesFor } from "./kin";
import { PICK_LABEL, type PickTarget } from "./picking";

type PersonPanelProps = {
  person: Person;
  people: Person[];
  /** Every id in the document, including the ones the schema rejected. */
  taken: string[];
  /** The field waiting for a card to be clicked, if any. */
  picking: PickTarget | null;
  onSet: (field: PlainField, value: string | number | null) => void;
  onRename: (to: string) => void;
  onArm: (target: PickTarget | null) => void;
  onLink: (spouseId: string) => void;
  onUnlink: (spouseId: string) => void;
  onRemove: () => void;
  onClose: () => void;
};

const GENDERS = ["male", "female", "other"] as const;

const PARENTS = [
  { field: "fatherId", label: "Father" },
  { field: "motherId", label: "Mother" },
] as const;

export function PersonPanel(props: PersonPanelProps) {
  const { person, people, taken, picking, onSet, onRename, onArm } = props;
  const { onLink, onUnlink, onRemove, onClose } = props;

  const byId = new Map(people.map((each) => [each.id, each]));
  const candidates = candidatesFor(people, person);

  const arm = (target: PickTarget) => onArm(picking === target ? null : target);

  return (
    <aside className="absolute top-0 right-0 z-10 flex h-full w-72 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900">{person.name}</h2>

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded px-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ×
        </button>
      </div>

      <Field label="Name">
        <input
          value={person.name}
          onChange={(event) => onSet("name", event.target.value)}
          className={inputStyle}
        />
      </Field>

      {picking !== null && (
        <p
          role="status"
          className="flex items-center justify-between gap-2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white"
        >
          <span>Click {PICK_LABEL[picking]} on the canvas</span>

          <button type="button" onClick={() => onArm(null)} className="underline underline-offset-2">
            Cancel
          </button>
        </p>
      )}

      <IdField id={person.id} taken={taken} onRename={onRename} />

      <Field label="Born">
        <input
          type="number"
          value={person.birthYear ?? ""}
          placeholder="Unknown"
          onChange={(event) => onSet("birthYear", yearFrom(event.target.value))}
          className={inputStyle}
        />
      </Field>

      <Field label="Gender">
        <select
          value={person.gender ?? ""}
          onChange={(event) => onSet("gender", event.target.value || null)}
          className={inputStyle}
        >
          <option value="">Not recorded</option>
          {GENDERS.map((gender) => (
            <option key={gender} value={gender}>
              {gender}
            </option>
          ))}
        </select>
      </Field>

      {PARENTS.map(({ field, label }) => (
        <Field key={field} label={label}>
          <div className="flex items-center gap-1.5">
            <PersonSelect
              value={person[field]}
              people={candidates}
              blank="Not recorded"
              onChange={(id) => onSet(field, id)}
            />

            <PickButton
              isArmed={picking === field}
              what={PICK_LABEL[field]}
              onToggle={() => arm(field)}
            />
          </div>
        </Field>
      ))}

      <Field label="Spouses">
        <SpouseList
          spouseIds={person.spouseIds ?? []}
          byId={byId}
          candidates={candidates}
          isArmed={picking === "spouse"}
          onArm={() => arm("spouse")}
          onLink={onLink}
          onUnlink={onUnlink}
        />
      </Field>

      {/* A family of nobody is not a document the schema accepts, so the last
          person cannot be deleted — only replaced by editing them. */}
      <button
        type="button"
        onClick={onRemove}
        disabled={people.length === 1}
        title={people.length === 1 ? "A family needs at least one person" : undefined}
        className="mt-auto rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-700 transition hover:bg-red-50 disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
      >
        Delete this person
      </button>
    </aside>
  );
}
