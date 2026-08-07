# Example families

Paste any of these into the panel on the left. Each one is here because it
breaks something a family tree drawing is naively assumed to be — most of them
were written while fixing the thing they break.

| File | What it is for |
| --- | --- |
| `one-person.json` | A family of one. The degenerate case: no unions, no lines, nothing to centre. |
| `remarriage.json` | Henry Tudor and three wives, a child by each. Nobody can stand beside three people, so the third marriage runs *below* the row rather than through the second wife's card. |
| `cousins-marry.json` | First cousins marry. Their descent lines rejoin, so the graph is not a tree; the parents still line up and nothing loops. |
| `brothers-marry-sisters.json` | Two brothers marry two sisters. Both sets of parents need a bar over children who sit interleaved, so the bars cross and have to be given separate heights. |
| `nine-generations.json` | A single line of descent, nine deep. Tall rather than wide, and the check that depth costs nothing. |
| `fourteen-children.json` | One couple, fourteen children. Three metres of bar, and the parents centred over the middle of it. |
| `unrelated-families.json` | Three families in one document, one of them a single mother. Also non-ASCII names and a name too long for its card. |
| `every-warning.json` | Deliberately wrong, but still drawable: parents swapped, a child older than their father, a father aged nine, someone born in the year 3000, a parent who does not exist, and a declared sibling who is not one. |

## What is not here

A file that fails outright. Errors stop the drawing rather than annotate it, so
there is nothing to look at — and any of these becomes one by deleting a letter
from an `id`, which turns two people into strangers and one reference into a
duplicate.

The kinds that are refused: two people sharing an id, somebody set as their own
parent or their own spouse, one person recorded as both father and mother, and
ancestry that loops back on itself.
