import { JsonEditor } from "../../components/JsonEditor";
import type { Problem } from "../../family/validate";
import { PanelActions } from "./PanelActions";
import { ProblemBadge } from "./ProblemBadge";

type JsonPanelProps = {
  value: string;
  problems: Problem[];
  /** Shown when nothing is wrong at all. */
  summary: string;
  isShown: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  /** A whole new document, rather than an edit to this one. */
  onLoad: (value: string) => void;
};

const TONE = {
  error: "text-red-700",
  warning: "text-amber-700",
};

export function JsonPanel(props: JsonPanelProps) {
  const { value, problems, summary, isShown, onToggle, onChange, onLoad } = props;
  const errors = problems.filter((each) => each.severity === "error").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden border-r border-slate-200 bg-white p-4">
      <div className={`flex items-start gap-2 ${isShown ? "justify-between" : "justify-center"}`}>
        {isShown && (
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900">Family JSON</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Paste a family here. Edits are kept for next time.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isShown}
          aria-label={isShown ? "Hide the JSON" : "Show the JSON"}
          title={isShown ? "Hide the JSON" : "Show the JSON"}
          className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          {isShown ? "«" : "»"}
        </button>
      </div>

      {!isShown && <ProblemBadge problems={problems} onOpen={onToggle} />}

      {/*
        Hidden rather than unmounted. The editor is built once and holds the
        undo history; taking it down to make room would throw that away, and
        put it back knowing nothing of what came before.
      */}
      <div className={`min-h-0 flex-1 flex-col gap-3 ${isShown ? "flex" : "hidden"}`}>
        <PanelActions value={value} onLoad={onLoad} />

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
    </div>
  );
}
