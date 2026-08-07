import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { forceLinting, linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { Problem } from "../family/validate";
import { locate } from "./json-locate";

type JsonEditorProps = {
  value: string;
  problems: Problem[];
  onChange: (value: string) => void;
};

/**
 * The colours VS Code uses for JSON in its Light+ theme. The default style
 * that ships with `basicSetup` leaves property names unstyled, which is the
 * one distinction that makes a document like this readable at a glance.
 */
const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "#0451a5" },
  { tag: tags.string, color: "#a31515" },
  { tag: tags.number, color: "#098658" },
  { tag: [tags.bool, tags.null], color: "#0000ff" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "12px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  ".cm-gutters": { border: "none" },
});

function toDiagnostics(state: EditorState, problems: Problem[]): Diagnostic[] {
  return problems.map((each) => {
    const range = locate(state, each.segments);

    return {
      // A problem the tree cannot place — the document is not parseable yet —
      // is pinned to the start rather than dropped.
      from: range?.from ?? 0,
      to: range?.to ?? 0,
      severity: "error",
      message: each.message,
    };
  });
}

export function JsonEditor({ value, problems, onChange }: JsonEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  // The editor is built once and then told about changes, so neither the
  // initial text nor a new callback identity may rebuild it mid-edit.
  const initialValue = useRef(value);
  const onChangeRef = useRef(onChange);
  const problemsRef = useRef(problems);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current ?? undefined,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: [
          basicSetup,
          json(),
          syntaxHighlighting(highlight),
          lintGutter(),
          linter((target) => toDiagnostics(target.state, problemsRef.current), { delay: 0 }),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });

    view.current = editor;

    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);

  /**
   * Text arriving from outside — the diagram was edited, so the document was
   * rewritten. Replacing it unconditionally would reset the cursor on every
   * keystroke, since our own edits come straight back through here.
   */
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;

    const current = editor.state.doc.toString();
    if (current === value) return;

    editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  // The linter reads the problems through a ref, so it has to be told when
  // they change rather than waiting for the next edit.
  useEffect(() => {
    problemsRef.current = problems;
    if (view.current) forceLinting(view.current);
  }, [problems]);

  return (
    <div ref={host} className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-300" />
  );
}
