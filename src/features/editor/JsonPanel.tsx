import { JsonEditor } from "../../components/JsonEditor";
import type { Problem } from "../../family/validate";

type JsonPanelProps = {
  value: string;
  problems: Problem[];
  /** Shown when there is nothing wrong. */
  summary: string;
  onChange: (value: string) => void;
};

export function JsonPanel({ value, problems, summary, onChange }: JsonPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 border-r border-slate-200 bg-white p-4">
      <div>
        <h1 className="text-sm font-semibold text-slate-900">Family JSON</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Paste a family here. The diagram follows as you type.
        </p>
      </div>

      <JsonEditor value={value} problems={problems} onChange={onChange} />

      {problems.length === 0 ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {summary}
        </p>
      ) : (
        <ul
          role="alert"
          className="max-h-48 space-y-1.5 overflow-y-auto rounded-md bg-red-50 p-3 text-xs text-red-700"
        >
          {problems.map((problem, index) => (
            <li key={`${problem.path}-${index}`}>
              {problem.path && <code className="font-mono font-medium">{problem.path}</code>}
              {problem.path && " — "}
              {problem.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
