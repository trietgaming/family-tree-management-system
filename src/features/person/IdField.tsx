import { idProblemOf } from "../../family/edit";
import { DraftField } from "./DraftField";

type IdFieldProps = {
  id: string;
  /** Every id in the document, so a clash is caught before it is written. */
  taken: string[];
  onRename: (to: string) => void;
};

/**
 * An id is not a field like the others: it is how the document names somebody,
 * so a new one has to be carried to every mention of them at once. It is
 * refused outright when it would be empty or would name two people the same.
 */
export function IdField({ id, taken, onRename }: IdFieldProps) {
  return (
    <DraftField
      label="Id"
      value={id}
      refuse={(draft) => idProblemOf(taken, id, draft)}
      onCommit={onRename}
      isMono
    />
  );
}
