import { JsonEditor } from "../../components/JsonEditor";
import type { Problem } from "../../family/validate";
import { PanelActions } from "./PanelActions";

type JsonPanelProps = {
  value: string;
  problems: Problem[];
  /** Shown when nothing is wrong at all. */
  summary: string;
  onChange: (value: string) => void;
};

const TONE = {
  error: "text-red-700",
  warning: "text-amber-700",
};

export function JsonPanel({ value, problems, summary, onChange }: JsonPanelProps) {
  const errors = problems.filter((each) => each.severity === "error").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 border-r border-slate-200 bg-white p-4">
      <div>
        <h1 className="text-sm font-semibold text-slate-900">Family JSON</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Paste a family here. Edits are kept for next time.
        </p>
      </div>

      <PanelActions value={value} onLoad={onChange} />

      <JsonEditor value={value} problems={problems} onChange={onChange} />

      {problems.length === 0 ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {summary}
        </p>
      ) : (
        <ul
          role={errors > 0 ? "alert" : "status"}
          className={`max-h-48 space-y-1.5 overflow-y-auto rounded-md p-3 text-xs ${
            errors > 0 ? "bg-red-50" : "bg-amber-50"
          }`}
        >
          {problems.map((each, index) => (
            <li key={`${each.path}-${index}`} className={TONE[each.severity]}>
              {each.path && <code className="font-mono font-medium">{each.path}</code>}
              {each.path && " — "}
              {each.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
