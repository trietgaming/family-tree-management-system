import { PersonId } from "../../family/model";
import { DraftField } from "./DraftField";

type IdFieldProps = {
  id: PersonId;
  /** Why the typed id cannot be used, or null when it can. */
  refuse: (to: PersonId) => string | null;
  onRename: (to: PersonId) => void;
};

/**
 * An id is not a field like the others: it is how the document names somebody,
 * so a new one has to be carried to every mention of them at once. It is
 * refused outright when it would be empty or would name two people the same.
 */
export function IdField({ id, refuse, onRename }: IdFieldProps) {
  return (
    <DraftField
      label="Id"
      value={id.value}
      refuse={(draft) => refuse(PersonId.of(draft))}
      onCommit={(draft) => onRename(PersonId.of(draft))}
      isMono
    />
  );
}
