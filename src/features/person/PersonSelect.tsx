import type { Person } from "../../family/model";
import { inputStyle } from "./Field";
import { labelOf } from "./kin";

type PersonSelectProps = {
  value: Person | null;
  people: Person[];
  /** Shown for the empty choice, which every parent is allowed to be. */
  blank: string;
  onChange: (person: Person | null) => void;
};

/**
 * A dropdown of people. The option values are ids because that is all a
 * `<select>` can hold, and the choice is turned back into a person here rather
 * than being handed out as one.
 */
export function PersonSelect({ value, people, blank, onChange }: PersonSelectProps) {
  return (
    <select
      value={value?.id.value ?? ""}
      onChange={(event) =>
        onChange(people.find((person) => person.id.value === event.target.value) ?? null)
      }
      className={inputStyle}
    >
      <option value="">{blank}</option>
      {people.map((person) => (
        <option key={person.id.value} value={person.id.value}>
          {labelOf(person)}
        </option>
      ))}
    </select>
  );
}
