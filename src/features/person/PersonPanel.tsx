import type { PlainField } from "../../family/edit";
import type { Person } from "../../family/schema";
import { Field, inputStyle } from "./Field";
import { PersonSelect } from "./PersonSelect";
import { SpouseList } from "./SpouseList";
import { candidatesFor } from "./kin";

type PersonPanelProps = {
  person: Person;
  people: Person[];
  onSet: (field: PlainField, value: string | number | null) => void;
  onLink: (spouseId: string) => void;
  onUnlink: (spouseId: string) => void;
  onRemove: () => void;
  onClose: () => void;
};

const GENDERS = ["male", "female", "other"] as const;

/** A year typed away to nothing is no year, not the number zero. */
function yearFrom(typed: string): number | null {
  const year = Number.parseInt(typed, 10);

  return Number.isNaN(year) ? null : year;
}

export function PersonPanel(props: PersonPanelProps) {
  const { person, people, onSet, onLink, onUnlink, onRemove, onClose } = props;

  const byId = new Map(people.map((each) => [each.id, each]));
  const candidates = candidatesFor(people, person);

  return (
    <aside className="absolute top-0 right-0 z-10 flex h-full w-72 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900">{person.name}</h2>
          <p className="truncate font-mono text-xs text-slate-400">{person.id}</p>
        </div>

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

      <Field label="Father">
        <PersonSelect
          value={person.fatherId}
          people={candidates}
          blank="Not recorded"
          onChange={(id) => onSet("fatherId", id)}
        />
      </Field>

      <Field label="Mother">
        <PersonSelect
          value={person.motherId}
          people={candidates}
          blank="Not recorded"
          onChange={(id) => onSet("motherId", id)}
        />
      </Field>

      <Field label="Spouses">
        <SpouseList
          spouseIds={person.spouseIds ?? []}
          byId={byId}
          candidates={candidates}
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
