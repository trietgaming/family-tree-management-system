import type {
  Mention,
  ParentRole,
  Person,
  PersonId,
  PersonRepository,
} from "../../family/model";
import { NEEDS_NAME, type Gender } from "../../family/schema";
import { yearFrom } from "../../family/years";
import { DraftField } from "./DraftField";
import { Field, inputStyle } from "./Field";
import { IdField } from "./IdField";
import { PersonSelect } from "./PersonSelect";
import { PickButton } from "./PickButton";
import { SpouseList } from "./SpouseList";
import { PICK_LABEL, type PickTarget } from "./picking";

type PersonPanelProps = {
  person: Person;
  repo: PersonRepository;
  /** The field waiting for a card to be clicked, if any. */
  picking: PickTarget | null;
  onName: (name: string) => void;
  onBirthYear: (year: number | null) => void;
  onGender: (gender: Gender | null) => void;
  onParent: (role: ParentRole, parent: Person | null) => void;
  refuseId: (to: PersonId) => string | null;
  onRename: (to: PersonId) => void;
  onArm: (target: PickTarget | null) => void;
  /** Move the canvas onto them, for when the panel is open and they are not. */
  onFocus: () => void;
  onLink: (spouse: Person) => void;
  onUnlink: (spouse: Mention) => void;
  onRemove: () => void;
  onClose: () => void;
};

const GENDERS: Gender[] = ["male", "female", "other"];

const PARENTS: { role: ParentRole; label: string }[] = [
  { role: "father", label: "Father" },
  { role: "mother", label: "Mother" },
];

export function PersonPanel(props: PersonPanelProps) {
  const { person, repo, picking, onName, onBirthYear, onGender, onParent } = props;
  const { refuseId, onRename, onArm, onFocus, onLink, onUnlink, onRemove, onClose } = props;

  const candidates = repo.candidatesFor(person);
  const arm = (target: PickTarget) => onArm(picking === target ? null : target);

  return (
    <aside className="absolute top-0 right-0 z-10 flex h-full w-72 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900">{person.name}</h2>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onFocus}
            title="Bring this person into view"
            className="rounded-md border border-slate-300 px-1.5 py-0.5 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            Focus
          </button>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded px-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
      </div>

      <DraftField
        label="Name"
        value={person.name}
        refuse={(draft) => (draft.trim() === "" ? NEEDS_NAME : null)}
        onCommit={onName}
      />

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

      <IdField id={person.id} refuse={refuseId} onRename={onRename} />

      <Field label="Born">
        <input
          type="number"
          value={person.birthYear ?? ""}
          placeholder="Unknown"
          onChange={(event) => onBirthYear(yearFrom(event.target.value))}
          className={inputStyle}
        />
      </Field>

      <Field label="Gender">
        <select
          value={person.gender ?? ""}
          onChange={(event) => onGender((event.target.value || null) as Gender | null)}
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

      {PARENTS.map(({ role, label }) => (
        <Field key={role} label={label} tie="parent">
          <div className="flex items-center gap-1.5">
            <PersonSelect
              value={person.parentAs(role)}
              people={candidates}
              blank="Not recorded"
              onChange={(parent) => onParent(role, parent)}
            />

            <PickButton
              isArmed={picking === role}
              what={PICK_LABEL[role]}
              onToggle={() => arm(role)}
            />
          </div>
        </Field>
      ))}

      <Field label="Spouses" tie="partner">
        <SpouseList
          spouses={person.spouseMentions}
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
        disabled={repo.all.length === 1}
        title={repo.all.length === 1 ? "A family needs at least one person" : undefined}
        className="mt-auto rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-700 transition hover:bg-red-50 disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
      >
        Delete this person
      </button>
    </aside>
  );
}
