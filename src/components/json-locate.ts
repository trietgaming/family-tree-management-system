import { syntaxTree } from "@codemirror/language";
import type { EditorState, Text } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/** The node kinds that stand for a JSON value; everything else is punctuation. */
const VALUES = new Set(["Object", "Array", "String", "Number", "True", "False", "Null"]);
const CONTAINERS = new Set(["Object", "Array"]);

export type Range = { from: number; to: number };

function valueChildren(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];

  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (VALUES.has(child.name)) children.push(child);
  }

  return children;
}

function propertyNamed(object: SyntaxNode, name: string, doc: Text): SyntaxNode | null {
  for (let child = object.firstChild; child; child = child.nextSibling) {
    if (child.name !== "Property") continue;

    const key = child.getChild("PropertyName");
    if (!key) continue;

    // The name token carries its quotes; JSON.parse turns the escapes back.
    if (JSON.parse(doc.sliceString(key.from, key.to)) === name) return child;
  }

  return null;
}

/**
 * Turns a problem's path, such as `["people", 6, "fatherId"]`, into the span of
 * text it refers to.
 *
 * The tree comes from the editor rather than a second parse of the string, so
 * the offsets are the ones the editor is already using, and a document that is
 * mid-edit and not valid JSON still resolves as far as it can.
 */
export function locate(state: EditorState, segments: readonly PropertyKey[]): Range | null {
  // A problem about the document as a whole has nowhere narrower to point.
  if (segments.length === 0) return null;

  let value: SyntaxNode | null = valueChildren(syntaxTree(state).topNode)[0] ?? null;
  let found: SyntaxNode | null = value;

  for (const segment of segments) {
    if (!value) return null;

    if (typeof segment === "number") {
      if (value.name !== "Array") return null;

      const element: SyntaxNode | undefined = valueChildren(value)[segment];
      if (!element) return null;

      found = element;
      value = element;
      continue;
    }

    if (value.name !== "Object") return null;

    const property = propertyNamed(value, String(segment), state.doc);
    if (!property) return null;

    found = property;
    value = valueChildren(property)[0] ?? null;
  }

  if (!found) return null;

  /**
   * A property holding an object or an array would underline the whole thing,
   * which for `people` is the entire document. The name alone points just as
   * well and stays out of the way.
   */
  if (found.name === "Property" && value && CONTAINERS.has(value.name)) {
    const key = found.getChild("PropertyName");
    if (key) return { from: key.from, to: key.to };
  }

  return { from: found.from, to: found.to };
}
