/**
 * Every family in `examples/`, bundled at build time. Reading the directory
 * rather than listing it means a new file shows up in the picker by existing.
 */
const files = import.meta.glob("../examples/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type Example = {
  id: string;
  label: string;
  text: string;
};

function labelOf(id: string): string {
  const words = id.replace(/-/g, " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}

const all: Example[] = Object.entries(files)
  .map(([path, text]) => {
    const id = path.split("/").pop()?.replace(/\.json$/, "") ?? path;

    return { id, label: labelOf(id), text };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

/** The one the exercise names, so it leads and it is what the page opens with. */
export const examples: Example[] = [
  ...all.filter((each) => each.id === "simpsons"),
  ...all.filter((each) => each.id !== "simpsons"),
];

export const openingExample: Example = examples[0];
