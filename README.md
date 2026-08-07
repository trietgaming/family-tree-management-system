# TASK 3: FTMS

A family tree you paste in as JSON and watch draw itself. One page, no server:
the document on the left, the diagram on the right, and nothing between them
but the code in this folder.

# Libraries, tools and frameworks

## Runtime dependencies

| Package | Used for |
| --- | --- |
| `react`, `react-dom` | UI. Version 19, so context is `<Context value>` and `use()` reads it. |
| `@xyflow/react` | The canvas: panning, zooming, the minimap, and the machinery for custom nodes and edges. It draws where it is told; it knows nothing about families. |
| `zod` | The shape of a person and a family, and the messages when a document does not match. |
| `codemirror` and `@codemirror/*` | The JSON editor: colouring, line numbers, and a marker in the gutter at the exact spot a problem was found. |
| `@lezer/*` | CodeMirror's parser. Its syntax tree is what turns `people[6].fatherId` into a span of text. |

No layout library used.

## Development dependencies

| Package | Used for |
| --- | --- |
| `vite`, `@vitejs/plugin-react` | Dev server with hot reload, and the production build. |
| `tailwindcss`, `@tailwindcss/vite` | Styling. Version 4 configures itself from `@import "tailwindcss"`, so there is no `tailwind.config.js`. |
| `typescript` | Type checking. `erasableSyntaxOnly` is on, so nothing here needs compiling beyond stripping types. |
| `oxlint` | Linting. It catches what the compiler cannot, notably `react/rules-of-hooks`. |

# Getting started

## Prerequisites

Node.js 20.19 or newer, which is what Vite 8 asks for. Nothing else — there is
no backend and no database.

## Running

```bash
npm install
```

```bash
npm run dev
```

The page is at http://localhost:5174. It opens on the Simpsons family, and
whatever you type is kept for next time.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload. |
| `npm run build` | Type checks, then bundles into `dist/`. |
| `npm run preview` | Serves the built bundle. |
| `npm run lint` | Runs oxlint. |

`base` is `"./"` in `vite.config.ts`, so one build runs at a domain root and in
the subdirectory GitHub Pages serves from without being rebuilt. That is safe
here because the app is a single page with no client-side routing.

# The document

A family is a flat list of people. Relationships are ids, not nesting, because
a child has two parents and nesting can only express one.

```json
{
  "people": [
    {
      "id": "homer",
      "name": "Homer Simpson",
      "gender": "male",
      "birthYear": 1956,
      "fatherId": "abe",
      "motherId": "mona",
      "spouseIds": ["marge"]
    }
  ]
}
```

Only `id` and `name` are required. `examples/` holds nine families to paste in,
each one chosen to break something; `examples/README.md` says what each breaks.

## Siblings are worked out, not written down

The brief names a sibling field, so `siblingIds` is accepted — but two people
are siblings when they share a parent, and storing that separately means the
document can contradict itself. The parents win, and a `siblingIds` that
disagrees is reported rather than quietly resolved.

## Two layers of checking

Zod answers *is this the right shape* — one field at a time, and it is the only
thing that can say `expected number, received string`.

A second pass answers *does this hold together*, which needs the whole graph:
duplicate ids, references to people who do not exist, someone set as their own
parent, ancestry that loops back on itself. Only this layer can say
`Homer Simpson cannot be their own parent`. Merging the two would leave only
the first kind of sentence.

## Errors and warnings

An **error** leaves the document meaning something the drawing cannot show, and
the drawing stops: two people sharing an id, somebody as their own parent or
their own spouse, one person recorded as both father and mother, ancestry that
loops.

A **warning** is data that holds together well enough to draw but says
something unlikely, and the tree appears with the doubt beside it: a father
recorded female, a parent born after their child or less than twelve years
before, a birth year in the future, a reference to nobody, a spouse named one
way round and not back.

The split exists because refusing to draw a fourteen-person family over one
mistyped id helps nobody. Both kinds are listed under the editor and marked in
its gutter.

# Architecture

## Folders

```
src/
  family/          the domain: no React, no DOM, testable with plain Node
    schema.ts      the shape of a person and a family
    validate.ts    the checks that need the whole graph
    parse.ts       text → a family, or a list of problems
    model.ts       people and unions
    layout/        the drawing, in stages
    id.ts          ids for people created in the app
  components/      the editor and its path-to-position lookup
  features/
    editor/        the panel, the example picker, the copy button
    tree/          the canvas, its nodes, its edges, the legend
  examples.ts      reads examples/ at build time
  storage.ts       the document, kept between visits
```

The line that matters is the one around `family/`. Nothing in it imports React,
so every decision in the drawing can be checked by a script — which is how the
layout was developed.

## A family tree is not a tree

A child has two parents. Two people can have children together and separately.
A parent can marry twice. None of that is a tree, and every classic tree layout
assumes one parent per node.

The way out is a **union**: an invisible node standing for a pairing. Parents
connect into it, children hang off it. Part of the family the page opens with:

```
   Abe ─────●───── Mona
            │
  Homer ────●──── Marge
            │
    ┌───────┼───────┐
  Bart    Lisa   Maggie
```

`model.ts` derives one union for every set of parents that produced somebody,
and one for every couple with no children, who would otherwise have nothing
joining them.

Marriage and parenthood stay separate facts. The same file has Abe fathering
Herbert with Edwina, whom he never married:

```
   Mona ──●── Abe ┄┄●┄┄ Edwina      ●  a union
          │         │                ─  married
        Homer    Herbert             ┄  together, not married
```

Two unions for one man, and only one of them a marriage. Homer and Herbert are
half brothers, which is a fact the drawing can only show because the pairing
and the marriage are recorded apart from each other.

## The layout, in stages

`layout/index.ts` is the whole algorithm, start to finish, in one short
function. Each stage below is a file beside it.

**Rows come from descent alone.** A child sits one row below its parents, and
partners share a row. Both rules only push downwards, so repeating them
settles. They contradict each other exactly once — when somebody has a child
with their own descendant — and there descent wins, because levelling the two
would push the descendant down again, and again, until a pass limit stopped it
on a meaningless number.

**Every person is given one home.** The graph is walked into trees, and a
spouse nobody has claimed yet is drawn beside their partner. That keeps couples
together even when they come from different families, and the price is that the
line up to *their* parents is a long one.

This is the trade the whole layout rests on. Because each person appears once,
placing them horizontally is a plain tree walk with nothing to reconcile
afterwards — which is what lets every joint sit exactly above its own children.
The alternative keeps both families tidy and splits the couple, and a family
tree that separates Homer from Marge is the wrong drawing.

**Columns come from that walk.** Subtrees are packed side by side and the
parents placed above them — but aligned by the child's own card rather than by
the middle of the child's block, since the block's middle is the gap between
the child and the child's spouse. Getting that wrong makes a line to an only
child leave the joint, jog sideways, and come back down for nothing.

Where a parent married more than once, the gap between spouses widens so each
joint lands over its own children. They never come closer than a card and a
gap; there is no upper limit, because a straight line is worth more than a tidy
one.

**Then the lines.** A marriage runs between the two cards when the pair can
stand together, and below the row when they cannot — a third marriage, or a
spouse living in another family's block — because a line at card height
disappears behind whoever is standing in between.

Two horizontal runs at the same height that overlap merge into one line, and
the drawing then claims a relationship that is not there. Overlapping runs are
given separate heights, narrowest first, so local runs stay low and one
reaching across the drawing rides above them. This applies to the bars down to
children and to the marriages of somebody married several times.

**Finally the dots.** A point gets one when three or more segments run out of
it. A corner has two and needs no explaining. Nothing that merely looks like a
meeting — one union's bar laid across another's drop — is ever marked, which is
what makes the absence of a dot mean something.

## What the drawing says

| | |
| --- | --- |
| Dark solid line between two cards | married: both named the other |
| Dark dashed line | together, but only inferred from a shared child |
| Light line | parent to child |
| Dot | the lines here meet |
| No dot at a crossing | they pass over each other |

The dashed line is not decoration. The model knows the difference between a
marriage both people recorded and a pairing worked out from a child, and a
solid line for both would assert something the document never said.

## The editor

CodeMirror rather than a textarea, for colouring, line numbers, and a real
undo — but mostly for the gutter. A problem carries its path in parts, and
`json-locate.ts` walks the editor's own syntax tree to turn `people[6].fatherId`
into a span of text. The tree comes from the editor rather than a second parse,
so a document that is mid-edit and not yet valid still resolves as far as it
can.

The editor is built once and only accepts text from outside when it differs
from what it already holds. Without that, the app's own edits arrive back
through `onChange` and reset the cursor on every keystroke.

## Editing on the canvas

Clicking a card opens a form for that person. Every control writes straight back
into the JSON, which stays the only thing the drawing is made from — there is no
second copy of the family to keep in step.

The write goes through `family/edit.ts`, and it works on `JSON.parse` of the
text rather than on the parsed family. The schema returns the keys it knows in
its own order and drops the ones it does not, so a round trip through it would
rewrite parts of the document nobody touched. Going through the raw JSON keeps
the key order and any extra keys; the only thing the app imposes is two-space
indentation.

Four rules the form follows:

- **Clearing a field removes it.** Absent and `null` mean the same thing to the
  schema, and absent is what the examples are written in.
- **Marriage is written on both people.** A one-sided `spouseIds` is a warning,
  and the form should not be able to produce a document it then complains about.
- **Deleting unlinks, it does not cascade.** The person goes, and every mention
  of them goes with them; their children stay and lose a parent. Deleting a
  grandparent should not quietly delete the family below them.
- **A parent picker never offers a descendant.** That would make somebody their
  own ancestor, which is an error rather than a warning — the drawing would stop
  at the last document that held together, and a picker able to freeze the page
  is a picker offering the wrong thing.

While the document does not parse there is nothing safe to write back over, so
the form steps aside until it does.

Because the layer is text in and text out, it is checked without a browser: an
edit, an add, a link and a delete run over each example and the result is parsed
again. One round costs 2 ms on the fifty-seven person file, which is the whole
of write, re-parse and re-layout.

## Between visits

The document is kept in `localStorage` and comes back on reload. It is written
300 ms after the last keystroke rather than on every one, and once more on
`pagehide`, so closing the tab mid-sentence does not cost the sentence.

Every call is guarded: a browser with storage switched off throws rather than
returns, and a full quota throws again. Neither is worth taking the page down
for — the document is still on screen, it just will not be there next time.

Keeping edits creates a trap, so the picker exists to get out of it. It reads
`examples/*.json` at build time, which means a new file appears in it by being
added to the folder.

# Assumptions and decisions

**Ids are opaque strings.** The examples use readable ones because the JSON is
meant to be read, but people created in the app get a random ten characters.
Nothing depends on the format.

**Gender is only checked for contradiction.** A father recorded female is
reported; a father with no gender recorded, or recorded as other, is not. An
absent value contradicts nothing, and *other* is not the opposite of anything.

**Nodes cannot be dragged.** Positions are the layout's answer, and a card
moved by hand would be a card in the wrong place with nothing to say so.

**Long links are accepted, not hidden.** Where a person is drawn beside their
spouse, the line to their own parents crosses the drawing. Genealogy software
often solves this by drawing the person twice; that would break the one thing
this page is for, because editing a person who appears twice has no obvious
meaning.
