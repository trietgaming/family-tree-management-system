import type { Person } from "../../family/schema";
import { inputStyle } from "./Field";
import { labelOf } from "./kin";

type PersonSelectProps = {
  value: string | null | undefined;
  people: Person[];
  /** Shown for the empty choice, which every parent is allowed to be. */
  blank: string;
  onChange: (id: string | null) => void;
};

export function PersonSelect({ value, people, blank, onChange }: PersonSelectProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className={inputStyle}
    >
      <option value="">{blank}</option>
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {labelOf(person)}
        </option>
      ))}
    </select>
  );
}
