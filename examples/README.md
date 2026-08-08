# Example families

Paste any of these into the panel on the left. Each one is here because it
breaks something a family tree drawing is naively assumed to be — most of them
were written while fixing the thing they break.

| File | What it is for |
| --- | --- |
| `simpsons.json` | The one the page opens with, and the one the exercise names. A half sibling, an unmarried couple, a single parent, and two pairs sharing a birth year. |
| `one-person.json` | A family of one. The degenerate case: no unions, no lines, nothing to centre. |
| `remarriage.json` | Henry Tudor and three wives, a child by each. Nobody can stand beside three people, so the third marriage runs *below* the row rather than through the second wife's card. |
| `cousins-marry.json` | First cousins marry. Their descent lines rejoin, so the graph is not a tree; the parents still line up and nothing loops. |
| `brothers-marry-sisters.json` | Two brothers marry two sisters. Both sets of parents need a bar over children who sit interleaved, so the bars cross and have to be given separate heights. |
| `nine-generations.json` | A single line of descent, nine deep. Tall rather than wide, and the check that depth costs nothing. |
| `fourteen-children.json` | One couple, fourteen children. Three metres of bar, and the parents centred over the middle of it. |
| `married-a-generation-down.json` | Ling marries Bart and Lisa's daughter, so she is drawn beside a wife two generations below her own mother. The bar from her mother has to reach down two rows to find her — hung under the parents rather than under the child, that drop would cross the row between and everything standing in it. |
| `married-two-sisters.json` | A widower marries his late wife's sister. Both wives are daughters of the same couple, so one marriage belongs to two households at once and has to be drawn by exactly one of them. |
| `tangled-generations.json` | Cousins marry, and one of them also has a child with the other's mother — who has a third child by her sister-in-law's husband. Marriage says a pair share a row, birth says one is below the other, and here the two rules chase each other in a circle. One woman stands in three pairings at once, so only the declared marriage seats her and the other two reach her by line. |
| `unrelated-families.json` | Three families in one document, one of them a single mother. Also non-ASCII names and a name too long for its card. |
| `dynasty.json` | Fifty-seven people, five founders, seven generations. Sibling marriage, first cousins twice over, double first cousins, a widower who marries his late wife's mother, a great-uncle who marries his great-niece, a nephew who has a child by his aunt, two single mothers, a single father, and a couple with five children. Everything the other files test at once, and the file to open when a change needs to be shown not to break anything. |
| `every-warning.json` | Deliberately wrong, but still drawable: parents swapped, a child older than their father, a father aged nine, someone born in the year 3000, a parent who does not exist, and a declared sibling who is not one. |

## What is not here

A file that fails outright. Errors stop the drawing rather than annotate it, so
there is nothing to look at — and any of these becomes one by deleting a letter
from an `id`, which turns two people into strangers and one reference into a
duplicate.

The kinds that are refused: two people sharing an id, somebody set as their own
parent or their own spouse, one person recorded as both father and mother, and
ancestry that loops back on itself.
