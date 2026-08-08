import type { ReactNode } from "react";
import { TIE_TEXT, type Tie } from "../tree/palette";

type FieldProps = {
  label: string;
  /**
   * A field that stands for a relationship wears its colour, the same one the
   * drawing gives that relationship. The rest of the form is about the person
   * rather than their ties, and stays grey.
   */
  tie?: Tie;
  children: ReactNode;
};

/** A label above its control, which is every row of this form. */
export function Field({ label, tie, children }: FieldProps) {
  return (
    <label className="block">
      <span className={`text-xs font-medium ${tie ? TIE_TEXT[tie] : "text-slate-500"}`}>
        {label}
      </span>

      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputStyle =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500";
