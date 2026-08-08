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
    edit.ts        changes, written back into the document as written
  components/      the editor and its path-to-position lookup
  features/
    editor/        the panel, the example picker, the copy button
    person/        the form behind a card, and its pickers
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

The panel folds away to a narrow rail when the drawing wants the room. Its
contents are hidden rather than unmounted: the editor is built once and holds
the undo history, so taking it down to make space would throw that away and put
it back knowing nothing of what came before. What stays visible is the toggle
and, when there is something wrong, a badge — the count in red for errors and
amber for warnings, counting errors on their own because one of them stops the
drawing and a number mixing the two would hide that. It says that something is
wrong and how much, not what; clicking it opens the panel, which is where the
reading is. Whether the panel was left open is remembered between visits.

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

Five rules the form follows:

- **An id can be changed, and every reference changes with it.** An id is not a
  field like the others: it is how the document names somebody, so editing one
  means rewriting every `fatherId`, `motherId`, `spouseIds` and `siblingIds`
  that mentions them in the same breath. It is refused outright — nothing
  written — when the result would be empty or would name two people the same,
  and the box says which. That field alone keeps what was typed rather than
  writing on every keystroke, because clearing it to retype is an ordinary
  thing to do and an empty id is not a document.

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

### Picking from the canvas

A dropdown of fifty-seven names is a poor way to say *that one, there*, when
that one is on screen already. So each of Father, Mother and the spouse list
has a picker beside it: arm the field, then click a card.

A picker per field rather than one mode for the whole form, because what is
being armed is *which* field, and a control that says so is one fewer thing to
remember. While a field is armed the panel says what the canvas is waiting for,
the cards take a crosshair, and Escape or Cancel calls it off.

Arming changes what a click on a card means, and that decision is made in one
place: the canvas only ever reports that somebody was clicked, and the app
decides whether that opens them or fills a field. A pick is only accepted from
somebody the dropdown would have offered — the pickers leave out a person's own
line for a reason, and a click must not be a way around it. A refused pick
leaves the field armed, because there was no way to say no to it and so it has
not been used up.

While the document does not parse there is nothing safe to write back over, so
the form steps aside until it does, and **Add person** on the canvas greys out
with it. That button sits on the canvas rather than beside the JSON because the
canvas is where people are looked at; a new person is appended joined to nobody
and selected at once, so the form opens ready to name them.

## Moving the view

Two things move the canvas, and they turn out to be the same thing.

The panel has a **Focus** button for the third case, which is a person whose
form is open while they themselves are somewhere off the edge — after a picker
sent the selection to somebody across the drawing, most often. It asks for the
same reveal the other two do.

Adding a person joined to nobody means the layout gives them a column of their
own past everything else — on the fifty-seven person file, x=6704 of a drawing
6880 wide, off screen at any zoom close enough to read. Loading an example is
the other: a different drawing entirely, under a view aimed at the last one.

Neither can be done in the click that asks for it, because the nodes only exist
once the document has been read back and laid out. So both are written down as
a `ViewRequest` and answered later, when the drawing can answer them:

```ts
type ViewRequest =
  | { at: number; kind: "fit" }
  | { at: number; kind: "reveal"; id: string };
```

`at` counts requests rather than naming them, so loading the example already on
screen still puts the view back where it started. A request that cannot be
answered yet is left standing and tried again on the next set of nodes, and the
one just answered is remembered — the node list is rebuilt on every keystroke,
and the view must not chase it.

Revealing zooms in only when the view was further out than a card can be read
at, so a comfortable zoom is never undone. Clicking a card is deliberately not
a request at all: the view stays exactly where it was put.

Because the layer is text in and text out, it is checked without a browser: an
edit, an add, a link and a delete run over each example and the result is parsed
again. One round costs 2 ms on the fifty-seven person file, which is the whole
of write, re-parse and re-layout.

## Following a person

Clicking a card lights the people it is joined to — parents, partners,
children — and the lines that join them. Clicking a line lights the line and
the people it names.

Both are the same question asked from two ends, and the layout already answered
it when it started saying who each line is about. A person's lines are exactly
the lines naming them: their marriages, their lines down to their children, and
the one their parents reach them by. The line to a sibling names the sibling,
not them, so it stays dark. And the people to light follow from the lines
rather than being worked out again — everybody a lit line names is somebody the
click is joined to.

Three ties, three colours, so the highlight says which way each relationship
goes and not merely that there is one:

| | |
| --- | --- |
| **orange** | up: the parents, and the line they reach the person by |
| **green** | down: the children, and the lines down to them |
| **purple** | across: the partners, married or not, and the lines between |

Which way a line goes is read from the line. A descent line ending at the
person clicked is the one their parents came down; any other descent line
naming them is one of theirs going down to a child. The people on a line do not
all share its tie: a line down to a child also names the other parent, who is a
partner and coloured as one. Where somebody is two things at once — the
documents here can do that — the closer tie wins, and birth is closer than
marriage, the same order the rows are worked out in.

Colour rather than weight: a thicker line among thin ones reads as heavy before
it reads as chosen, and hue leaves the year filter its own channel, which is
opacity. Purple because a card's own colours already spend blue, pink and
violet on saying what somebody is. The card clicked stands up off the page as
well as changing colour, so it is never hue alone that tells it from the people
it reaches.

A mark where lines meet takes the closest tie of everybody it stands for, and
stays grey unless it stands for them all — so it never sits grey on a coloured
line, or coloured on a grey one.

Lit lines are drawn last, because an edge is drawn in the order it is given and
a highlight under a neighbour is no highlight. A line is given a wider
invisible band to be clicked on, since a one-pixel line is a one-pixel target.

## Filtering by year

*Show people born from … to …*, in two boxes either of which may be left
empty — a slider would have to invent both ends before it could be dragged, and
*born before 1900* is a question with only one. Nobody is removed: people
outside the range fade to a fifth, which
keeps the shape of the family intact. Hiding a person in the middle would cut
the tree in two and say something the document does not.

The rule reaches past the cards. **A line or a dot fades when everybody it is
about is outside the range** — one still leading to somebody in view is worth
following, so it stays. That needed the layout to say who each line joins,
because `source` and `target` cannot: either of them may be a union, which is a
joint rather than a person. So `LayoutEdge` and `Junction` now carry the people
they are about, which the router knew all along and used to throw away.

Fading is applied over the finished drawing rather than inside it, so changing
the range never re-runs the layout.

**Somebody with no year recorded never fades.** An absent year is not evidence
of being born elsewhere in time; it is the absence of evidence, and the same
reading validation gives it.

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
Nothing depends on the format, which is why one can be edited into anything
that is not already taken.

**Gender is only checked for contradiction.** A father recorded female is
reported; a father with no gender recorded, or recorded as other, is not. An
absent value contradicts nothing, and *other* is not the opposite of anything.

**Nodes cannot be dragged.** Positions are the layout's answer, and a card
moved by hand would be a card in the wrong place with nothing to say so.

**A handover steps back along its line when another one has its column.**
Somebody in two pairings whose children both lie beyond them gets both
handovers pushed onto their own column, and two lines then fall down it with
nothing to tell them apart. Only a handover already pushed to the end of its
line moves: it has given up on standing over its children, so stepping back
along the line costs it nothing, while one still standing over them has
something to lose and keeps it.

**A long drop moves off the middle of its card when the middle is taken.** A
partner standing a row above their marriage falls the whole depth of a band
that is not theirs. Anything already running down that column — another
pairing's handover, its line to a child — is then drawn twice over, and the two
read as one line from the top of the first to the bottom of the last: a parent
and child the document never claimed. Only these drops move, and only past what
cannot: a card the run would fall through, and a run that does not start where
this one starts. Runs that do start together are a card's stem and are read as
one. The step is four pixels because the room usually is small — two cards
standing side by side leave a corridor one gap wide, and that corridor is often
the only way down.

**A lane is searched for until one is free.** The band between two rows has
room for a certain number of lines, and the search used to stop there and hand
whatever was left a fixed lane. With one line overflowing that is harmless;
with two it puts them at the same height, which is the one thing lanes exist to
prevent. Crowding into the space below is the lesser fault — and the two kinds
of lane can never collide, since marriage lanes count down from `rowY(r) + 86`
and bars count up from `rowY(r) + 134`, eighteen at a time.

**A bar hangs under its children, not under its parents.** Those are the same
row almost always, and differ when a child is drawn more than one row down —
married to somebody further along the line, most often. Hanging it under the
parents there leaves the drop to that child crossing every row between, and any
card standing in the way; the drawing then says the card it passes behind is
the parent, which is not what the document says.

**Long links are accepted, not hidden.** Where a person is drawn beside their
spouse, the line to their own parents crosses the drawing. Genealogy software
often solves this by drawing the person twice; that would break the one thing
this page is for, because editing a person who appears twice has no obvious
meaning.
